import { desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { toCsv } from "@/db/sample-events";
import { attendance, batches, centres, students, testScores } from "@/db/schema";
import { addDays, daysBetween, type IsoDate } from "@/domain/dates";
import { balanceOf } from "@/domain/instalments";
import type { PipelineEvent } from "@/domain/pipeline";
import { instalmentsOfMany } from "./ledger";

/** The guided story pays these by hand, so the simulated parents leave them alone. */
const STORY_STUDENTS = ["STU-0412", "STU-0587", "STU-0219"];

const FIRST_TEST = "2026-07-25";
const TEST_EVERY_DAYS = 18;
const PAY_CHANCE_PERCENT = 10;

/** A repeatable number from 0 to 99, so a demo plays out the same way after every reset. */
function roll(key: string): number {
  let hash = 2166136261;
  for (const char of key) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0) % 100;
}

const drift = (key: string) => {
  const value = roll(key);
  return value < 20 ? -1 : value >= 80 ? 1 : 0;
};

const groupBy = <T>(rows: T[], key: (row: T) => string) => {
  const groups = new Map<string, T[]>();
  for (const row of rows) groups.set(key(row), [...(groups.get(key(row)) ?? []), row]);
  return groups;
};

/**
 * Stands in for the outside world on days after the sample ends: parents paying, and centres
 * sending their files. It only makes events, so everything still goes through the real pipeline.
 */
export async function liveFeed(date: IsoDate): Promise<PipelineEvent[]> {
  const active = await db
    .select({ id: students.id, code: students.code, batch: batches.name, centre: centres.name })
    .from(students)
    .innerJoin(batches, eq(batches.id, students.batchId))
    .innerJoin(centres, eq(centres.id, batches.centreId))
    .where(isNull(students.exitDate));
  const ids = active.map((student) => student.id);
  if (ids.length === 0) return [];

  const codeOf = new Map(active.map((student) => [student.id, student.code]));
  const events: PipelineEvent[] = [];

  for (const item of await instalmentsOfMany(ids)) {
    const code = codeOf.get(item.studentId)!;
    const balance = balanceOf(item);
    if (balance === 0 || STORY_STUDENTS.includes(code) || item.dueDate > addDays(date, 2)) continue;
    if (roll(`${code}-${item.sequence}-${date}`) >= PAY_CHANCE_PERCENT) continue;

    events.push({
      on: date,
      kind: "gateway",
      gatewayRef: `SIM-${code}-${item.sequence}-${date}`,
      instalment: { code, sequence: item.sequence },
      amount: balance,
    });
  }

  const isSunday = new Date(`${date}T00:00:00Z`).getUTCDay() === 0;
  if (isSunday) events.push(...(await attendanceFiles(active, ids, date)));

  const sinceFirstTest = daysBetween(FIRST_TEST, date);
  if (sinceFirstTest % TEST_EVERY_DAYS === 0) {
    const testNumber = sinceFirstTest / TEST_EVERY_DAYS + 1;
    events.push(...(await scoreFiles(active, ids, date, `Unit Test ${testNumber}`)));
  }

  return events;
}

type Active = { id: string; code: string; batch: string; centre: string };

/** Students whose records have already stopped stay stopped, as they would in real life. */
async function attendanceFiles(active: Active[], ids: string[], date: IsoDate) {
  const weekStart = addDays(date, -6);
  const rows = await db
    .select()
    .from(attendance)
    .where(inArray(attendance.studentId, ids))
    .orderBy(desc(attendance.weekStart));
  const latest = new Map<string, (typeof rows)[number]>();
  for (const row of rows) if (!latest.has(row.studentId)) latest.set(row.studentId, row);

  const files: PipelineEvent[] = [];
  for (const batch of groupBy(active, (s) => `${s.centre}|${s.batch}`).values()) {
    const lines = batch.flatMap((student) => {
      const last = latest.get(student.id);
      if (!last || daysBetween(last.weekStart, weekStart) > 7) return [];
      const present = Math.min(
        last.total,
        Math.max(0, last.present + drift(`${student.code}-${date}`)),
      );
      return [[student.code, weekStart, present, last.total]];
    });
    if (lines.length === 0) continue;

    files.push({
      on: date,
      kind: "upload",
      centre: batch[0].centre,
      batch: batch[0].batch,
      file: "attendance",
      text: toCsv([["Student ID", "Week start", "Present", "Total"], ...lines]),
    });
  }
  return files;
}

async function scoreFiles(active: Active[], ids: string[], date: IsoDate, testName: string) {
  const rows = await db
    .select()
    .from(testScores)
    .where(inArray(testScores.studentId, ids))
    .orderBy(desc(testScores.takenOn));
  const latest = new Map<string, (typeof rows)[number]>();
  for (const row of rows) if (!latest.has(row.studentId)) latest.set(row.studentId, row);

  const files: PipelineEvent[] = [];
  for (const batch of groupBy(active, (s) => `${s.centre}|${s.batch}`).values()) {
    const lines = batch.flatMap((student) => {
      const last = latest.get(student.id);
      if (!last) return [];
      const score = Math.min(
        last.maxScore,
        Math.max(0, last.score + drift(`${student.code}-${testName}`) * 12),
      );
      return [[student.code, testName, date, score, last.maxScore]];
    });
    if (lines.length === 0) continue;

    files.push({
      on: date,
      kind: "upload",
      centre: batch[0].centre,
      batch: batch[0].batch,
      file: "scores",
      text: toCsv([["Student ID", "Test name", "Date", "Score", "Max score"], ...lines]),
    });
  }
  return files;
}
