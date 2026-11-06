import { and, asc, desc, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { loadSampleData } from "@/db/sample/load";
import { instalments, payments, pipelineRuns, students } from "@/db/schema";
import { addDays, type IsoDate } from "@/domain/dates";
import { addCounts, emptyCounts } from "@/domain/pipeline";
import { setDemoToday, today } from "./clock";
import { env } from "./env";
import { payLinkFor } from "./pay-links";
import { runDay } from "./pipeline";
import { liveFeed } from "./simulator";

export const MAX_JUMP_DAYS = 62;

function requireDemo() {
  if (!env.DEMO_MODE) throw new Error("Only available in demo mode");
}

/** The moved date lives in memory, so after a restart it comes back from the recorded runs. */
export async function syncDemoClock() {
  requireDemo();
  const [latest] = await db
    .select({ runOn: pipelineRuns.runOn })
    .from(pipelineRuns)
    .where(eq(pipelineRuns.source, "time-machine"))
    .orderBy(desc(pipelineRuns.runOn))
    .limit(1);
  setDemoToday(latest?.runOn ?? null);
}

/**
 * Runs each day in turn, exactly as a month of scheduled runs would. The date only moves
 * forward: going back would leave reminders sent in the future, so Reset is the way back.
 */
export async function moveDemoDate(days: number) {
  requireDemo();
  if (!Number.isInteger(days) || days < 1 || days > MAX_JUMP_DAYS) {
    throw new Error("Days out of range");
  }

  let counts = emptyCounts();
  const start = today();

  // The demo date's own jobs are left to run, so they go first.
  const [ranToday] = await db
    .select({ id: pipelineRuns.id })
    .from(pipelineRuns)
    .where(eq(pipelineRuns.runOn, start))
    .limit(1);
  if (!ranToday) counts = addCounts(counts, (await runDay(start, "staff")).counts);

  for (let step = 1; step <= days; step += 1) {
    const date = addDays(start, step);
    const run = await runDay(date, "time-machine", await liveFeed(date));
    counts = addCounts(counts, run.counts);
    setDemoToday(date);
  }

  return counts;
}

/** Days to the next unpaid due date, for the "next due date" button. */
export async function daysToNextDue(date: IsoDate = today()): Promise<number> {
  const [next] = await db
    .select({ days: sql<number>`(${instalments.dueDate} - ${date}::date)::int` })
    .from(instalments)
    .innerJoin(students, eq(students.id, instalments.studentId))
    .where(and(gt(instalments.dueDate, date), sql`${students.exitDate} is null`))
    .orderBy(asc(instalments.dueDate))
    .limit(1);
  return Math.min(next?.days ?? 1, MAX_JUMP_DAYS);
}

export async function resetDemo() {
  requireDemo();
  setDemoToday(null);
  await loadSampleData();
}

/** The fixed cast of the guided story. */
export async function storyLinks() {
  requireDemo();
  const [row] = await db
    .select({
      studentId: students.id,
      instalmentId: instalments.id,
      amount: instalments.amountPaise,
      paid: sql<number>`coalesce(sum(${payments.amountPaise}) filter (where ${payments.status} = 'matched'), 0)::int`,
    })
    .from(instalments)
    .innerJoin(students, eq(students.id, instalments.studentId))
    .leftJoin(payments, eq(payments.instalmentId, instalments.id))
    .where(and(eq(students.code, "STU-0587"), eq(instalments.sequence, 2)))
    .groupBy(instalments.id, students.id);
  if (!row) return null;

  return {
    ledger: `/staff/students/${row.studentId}`,
    payLink: payLinkFor(row.instalmentId),
    paid: row.paid >= row.amount,
  };
}
