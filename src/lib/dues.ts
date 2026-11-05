import { and, asc, count, desc, eq, gte, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { batches, centres, instalments, payments, students } from "@/db/schema";
import { addDays, type IsoDate } from "@/domain/dates";
import type { TallyReceipt } from "@/domain/tally";
import { instalmentFields } from "./ledger";

export type DuesFilters = { centreId: string | null; batch: string | null };

const inScope = ({ centreId, batch }: DuesFilters) =>
  and(
    centreId ? eq(centres.id, centreId) : undefined,
    batch ? eq(batches.name, batch) : undefined,
  );

/** Students who have left are not in dues: their fee account is closed. */
export function duesInstalments(filters: DuesFilters) {
  return db
    .select({
      ...instalmentFields,
      batchId: batches.id,
      batch: batches.name,
      centre: centres.name,
    })
    .from(instalments)
    .innerJoin(students, eq(students.id, instalments.studentId))
    .innerJoin(batches, eq(batches.id, students.batchId))
    .innerJoin(centres, eq(centres.id, batches.centreId))
    .leftJoin(payments, eq(payments.instalmentId, instalments.id))
    .where(and(isNull(students.exitDate), inScope(filters)))
    .groupBy(instalments.id, batches.id, centres.id);
}

export async function countStudentsLeft(filters: DuesFilters) {
  const [{ total }] = await db
    .select({ total: count() })
    .from(students)
    .innerJoin(batches, eq(batches.id, students.batchId))
    .innerJoin(centres, eq(centres.id, batches.centreId))
    .where(and(isNotNull(students.exitDate), inScope(filters)));
  return total;
}

/** The same batch name runs at several centres, so the filter offers each name once. */
export async function allBatchNames() {
  const rows = await db
    .selectDistinct({ name: batches.name })
    .from(batches)
    .orderBy(asc(batches.name));
  return rows.map((row) => row.name);
}

export const QUEUE_LIMIT = 25;

/** The accounts queue from the brief. Read only: nothing here has been applied to a fee. */
export async function unmatchedQueue() {
  const unmatched = eq(payments.status, "unmatched");

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: payments.id,
        reference: payments.gatewayRef,
        amount: payments.amountPaise,
        reason: payments.unmatchedReason,
        paidAt: payments.paidAt,
        studentId: students.id,
        studentCode: students.code,
      })
      .from(payments)
      .leftJoin(instalments, sql`${instalments.id}::text = ${payments.claimedRef}`)
      .leftJoin(students, eq(students.id, instalments.studentId))
      .where(unmatched)
      .orderBy(desc(payments.paidAt))
      .limit(QUEUE_LIMIT),
    db.select({ total: count() }).from(payments).where(unmatched),
  ]);

  return { rows, total };
}

type ExportRange = DuesFilters & { from: IsoDate; to: IsoDate };

/**
 * Money that was really received, so this includes students who have since left.
 * Unmatched payments are left out until staff resolve them. Dates match the receipts.
 */
export async function tallyReceipts({ from, to, ...filters }: ExportRange): Promise<TallyReceipt[]> {
  const rows = await db
    .select({
      receiptNo: payments.receiptNo,
      paidAt: payments.paidAt,
      centre: centres.name,
      batch: batches.name,
      studentCode: students.code,
      sequence: instalments.sequence,
      method: payments.method,
      reference: sql<string>`coalesce(${payments.externalRef}, ${payments.gatewayRef})`,
      amount: payments.amountPaise,
    })
    .from(payments)
    .innerJoin(instalments, eq(instalments.id, payments.instalmentId))
    .innerJoin(students, eq(students.id, instalments.studentId))
    .innerJoin(batches, eq(batches.id, students.batchId))
    .innerJoin(centres, eq(centres.id, batches.centreId))
    .where(
      and(
        eq(payments.status, "matched"),
        gte(payments.paidAt, new Date(`${from}T00:00:00.000Z`)),
        lt(payments.paidAt, new Date(`${addDays(to, 1)}T00:00:00.000Z`)),
        inScope(filters),
      ),
    )
    .orderBy(asc(payments.paidAt), asc(payments.receiptNo));

  return rows.map(({ paidAt, ...row }) => ({
    ...row,
    paidOn: paidAt.toISOString().slice(0, 10),
  }));
}
