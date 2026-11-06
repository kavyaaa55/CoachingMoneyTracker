import { and, desc, eq, gte, inArray, isNotNull, isNull, lt, lte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { batches, monthCloses, payments, refunds, students } from "@/db/schema";
import { daysToClose, lastDayOf, receiptGaps, suggestMatches, tallyFileTotals } from "@/domain/books";
import type { QueueCandidate } from "@/domain/books";
import { addDays, type IsoDate } from "@/domain/dates";
import { balanceOf } from "@/domain/instalments";
import { tallyCsv } from "@/domain/tally";
import { audit } from "./audit";
import { today } from "./clock";
import { tallyCreditNotes, tallyReceipts, tallyReversals, unmatchedQueue } from "./dues";
import { instalmentsOfMany } from "./ledger";

const startOfIndiaDay = (date: IsoDate) => new Date(`${date}T00:00:00+05:30`);

/** Not cast to int: a real month's receipts run to crores, past what 32 bits can hold. */
const total = sql`coalesce(sum(${payments.amountPaise}), 0)`.mapWith(Number);

export type MonthCheck = "ledger-tally" | "credit-notes" | "reversals" | "queue" | "receipts";

/** The month-end checks. The ledger side and the Tally side are worked out separately. */
export async function monthReport(month: string) {
  const from = `${month}-01`;
  const to = lastDayOf(month);
  const range = { from, to, centreId: null, batch: null };
  const inMonth = and(
    gte(payments.paidAt, startOfIndiaDay(from)),
    lt(payments.paidAt, startOfIndiaDay(addDays(to, 1))),
  );

  const [receipts, reversals, creditNotes, [ledger], [reversed], [refunded], [queued], numbers, closes] =
    await Promise.all([
      tallyReceipts(range),
      tallyReversals(range),
      tallyCreditNotes(range),
      db
        .select({ total })
        .from(payments)
        .where(and(inMonth, inArray(payments.status, ["matched", "reversed"]))),
      db
        .select({ total })
        .from(payments)
        .where(
          and(
            eq(payments.status, "reversed"),
            gte(payments.reversedOn, from),
            lte(payments.reversedOn, to),
          ),
        ),
      db
        .select({ total: sql`coalesce(sum(${refunds.refundPaise}), 0)`.mapWith(Number) })
        .from(refunds)
        .where(and(gte(refunds.paidOn, from), lte(refunds.paidOn, to))),
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(payments)
        .where(and(inMonth, eq(payments.status, "unmatched"))),
      db
        .select({ receiptNo: payments.receiptNo })
        .from(payments)
        .where(isNotNull(payments.receiptNo)),
      db.select().from(monthCloses).where(eq(monthCloses.month, month)),
    ]);

  const file = tallyFileTotals(tallyCsv([...receipts, ...reversals, ...creditNotes]));
  const gaps = receiptGaps(numbers.map((row) => row.receiptNo!));

  const checks: { check: MonthCheck; passed: boolean; left: number; right: number }[] = [
    { check: "ledger-tally", passed: ledger.total === file.receipts, left: ledger.total, right: file.receipts },
    { check: "reversals", passed: reversed.total === file.reversals, left: reversed.total, right: file.reversals },
    { check: "credit-notes", passed: refunded.total === file.creditNotes, left: refunded.total, right: file.creditNotes },
    { check: "queue", passed: queued.total === 0, left: queued.total, right: 0 },
    { check: "receipts", passed: gaps.length === 0, left: gaps.length, right: 0 },
  ];

  return { checks, passed: checks.every((item) => item.passed), close: closes[0] ?? null };
}

export type CloseOutcome = "closed" | "already-closed" | "month-not-over" | "checks-failed";

/** A person closes a month, and only once it is over and every check passes. */
export async function closeMonth(
  { month, closedBy }: { month: string; closedBy: string },
  date: IsoDate = today(),
): Promise<CloseOutcome> {
  if (lastDayOf(month) >= date) return "month-not-over";

  const report = await monthReport(month);
  if (report.close) return "already-closed";
  if (!report.passed) return "checks-failed";

  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(monthCloses)
      .values({ month, closedOn: date, closedBy })
      .onConflictDoNothing()
      .returning({ id: monthCloses.id });
    if (inserted.length === 0) return "already-closed";

    await audit(tx, {
      actorId: closedBy,
      action: "month.closed",
      entityId: inserted[0].id,
      detail: { month, daysToClose: daysToClose(month, date) },
    });
    return "closed";
  });
}

export async function latestClose() {
  const [row] = await db.select().from(monthCloses).orderBy(desc(monthCloses.month)).limit(1);
  return row ? { month: row.month, days: daysToClose(row.month, row.closedOn) } : null;
}

/** The queue, with suggestions a person can accept. Students who have left are not offered. */
export async function queueWithSuggestions() {
  const queue = await unmatchedQueue();

  const active = await db
    .select({ id: students.id, code: students.code, name: students.name, batch: batches.name })
    .from(students)
    .innerJoin(batches, eq(batches.id, students.batchId))
    .where(isNull(students.exitDate));
  const byId = new Map(active.map((student) => [student.id, student]));

  const rows = active.length > 0 ? await instalmentsOfMany(active.map((student) => student.id)) : [];
  const candidates: QueueCandidate[] = rows
    .filter((item) => balanceOf(item) > 0)
    .map((item) => ({
      batch: byId.get(item.studentId)!.batch,
      instalmentId: item.id,
      studentId: item.studentId,
      studentCode: byId.get(item.studentId)!.code,
      studentName: byId.get(item.studentId)!.name,
      sequence: item.sequence,
      balance: balanceOf(item),
      dueDate: item.dueDate,
    }));

  return {
    total: queue.total,
    rows: queue.rows.map((row) => ({
      ...row,
      suggestions: suggestMatches(row.amount, row.studentId, candidates, row.hints),
    })),
  };
}
