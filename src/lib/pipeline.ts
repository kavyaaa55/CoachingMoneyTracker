import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { batches, centres, instalments, payments, pipelineRuns, students, users } from "@/db/schema";
import { addDays, type IsoDate } from "@/domain/dates";
import {
  addCounts,
  emptyCounts,
  type InstalmentRef,
  type PipelineCounts,
  type PipelineEvent,
  type PipelineSource,
} from "@/domain/pipeline";
import { closeMonth } from "./books";
import { today } from "./clock";
import { recordPayment, reversePayment } from "./payments";
import { approveRefund, markRefundPaid, refundOf, saveRefund } from "./refunds";
import { runReminders } from "./reminders";
import { runRiskCheck } from "./risk";
import { saveUpload } from "./upload";

/** The sample's two accounts users, who act for the events that need a person. */
export const MAKER_PHONE = "+919000000100";
export const CHECKER_PHONE = "+919000000101";

async function staffId(phone: string) {
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.phone, phone));
  if (!user) throw new Error(`No staff user for ${phone}`);
  return user.id;
}

async function studentId(code: string) {
  const [student] = await db
    .select({ id: students.id })
    .from(students)
    .where(eq(students.code, code));
  if (!student) throw new Error(`No student ${code}`);
  return student.id;
}

async function instalmentId({ code, sequence }: InstalmentRef) {
  const [row] = await db
    .select({ id: instalments.id })
    .from(instalments)
    .innerJoin(students, eq(students.id, instalments.studentId))
    .where(and(eq(students.code, code), eq(instalments.sequence, sequence)));
  return row?.id ?? null;
}

async function batchId(centre: string, batch: string) {
  const [row] = await db
    .select({ id: batches.id })
    .from(batches)
    .innerJoin(centres, eq(centres.id, batches.centreId))
    .where(and(eq(centres.name, centre), eq(batches.name, batch)));
  if (!row) throw new Error(`No batch ${batch} at ${centre}`);
  return row.id;
}

async function refundIdOf(code: string) {
  const refund = await refundOf(await studentId(code));
  if (!refund) throw new Error(`No refund for ${code}`);
  return refund.id;
}

/** Hands one event to the same code a live event uses. */
async function applyEvent(event: PipelineEvent): Promise<Partial<PipelineCounts>> {
  const paidAt = `${event.on}T06:00:00.000Z`;

  switch (event.kind) {
    case "gateway":
    case "counter": {
      const result = await recordPayment(
        {
          gatewayRef: event.gatewayRef,
          instalmentRef: event.instalment && (await instalmentId(event.instalment)),
          amountPaise: event.amount,
          paidAt,
        },
        event.kind === "counter"
          ? { method: "cash", externalRef: null, recordedBy: await staffId(MAKER_PHONE) }
          : undefined,
      );
      return result.status === "matched" ? { paymentsMatched: 1 } : { paymentsQueued: 1 };
    }
    case "upload": {
      const result = await saveUpload(
        {
          kind: event.file,
          batchId: await batchId(event.centre, event.batch),
          text: event.text,
        },
        event.on,
      );
      return result.saved
        ? { recordsUploaded: result.added + result.changed }
        : { uploadsRejected: 1 };
    }
    case "exit": {
      const outcome = await saveRefund(
        {
          studentId: await studentId(event.code),
          exitDate: event.on,
          createdBy: await staffId(MAKER_PHONE),
        },
        event.on,
      );
      return outcome === "saved" ? { studentsLeft: 1 } : {};
    }
    case "reversal": {
      const [payment] = await db
        .select({ id: payments.id })
        .from(payments)
        .where(eq(payments.gatewayRef, event.gatewayRef));
      await reversePayment(
        { paymentId: payment.id, note: event.note, reversedBy: await staffId(MAKER_PHONE) },
        event.on,
      );
      return {};
    }
    case "month-closed": {
      await closeMonth({ month: event.month, closedBy: await staffId(CHECKER_PHONE) }, event.on);
      return {};
    }
    case "refund-approved": {
      const refundId = await refundIdOf(event.code);
      await approveRefund({ refundId, approvedBy: await staffId(CHECKER_PHONE) }, event.on);
      return {};
    }
    case "refund-paid": {
      await markRefundPaid(
        {
          refundId: await refundIdOf(event.code),
          paidBy: await staffId(CHECKER_PHONE),
          paidOn: event.on,
          method: "bank_transfer",
          reference: event.reference,
        },
        event.on,
      );
      return {};
    }
  }
}

/** Events only. The last replayed day uses this, so the demo date's jobs are left to run. */
export async function applyEvents(events: PipelineEvent[]) {
  let counts = emptyCounts();
  for (const event of events) counts = addCounts(counts, await applyEvent(event));
  return counts;
}

/**
 * One day of the real pipeline: take in what arrived, then run the daily jobs. A stage that
 * fails is recorded and does not stop the next, so a provider outage cannot block the risk check.
 */
export async function runDay(
  date: IsoDate = today(),
  source: PipelineSource = "cron",
  events: PipelineEvent[] = [],
) {
  let counts = await applyEvents(events);
  const failed: string[] = [];

  try {
    const { sent, stopped, failed: notSent } = await runReminders(date);
    counts = addCounts(counts, {
      remindersSent: sent,
      remindersStopped: stopped,
      remindersFailed: notSent,
    });
  } catch {
    failed.push("reminders");
  }

  try {
    const { flagged } = await runRiskCheck(date);
    counts = addCounts(counts, { tasksCreated: flagged });
  } catch {
    failed.push("risk");
  }

  await db.insert(pipelineRuns).values({ runOn: date, source, counts, failed });
  return { counts, failed };
}

/** Runs every day from one date up to, but not including, the last, whose jobs are left to run. */
export async function replayDays(
  from: IsoDate,
  until: IsoDate,
  events: PipelineEvent[],
  source: PipelineSource,
) {
  for (let date = from; date < until; date = addDays(date, 1)) {
    await runDay(
      date,
      source,
      events.filter((event) => event.on === date),
    );
  }
  await applyEvents(events.filter((event) => event.on === until));
}

export const RUNS_SHOWN = 10;

export function recentRuns() {
  return db
    .select()
    .from(pipelineRuns)
    .orderBy(desc(pipelineRuns.runOn), desc(pipelineRuns.createdAt))
    .limit(RUNS_SHOWN);
}
