import { and, asc, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { batches, instalments, payments, students } from "@/db/schema";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value: string) => UUID.test(value);

const paidSum = sql<number>`coalesce(sum(${payments.amountPaise}) filter (where ${payments.status} = 'matched'), 0)::int`;

/** A reversed payment keeps its receipt, shown as cancelled. It no longer counts as paid. */
const hasReceipt = inArray(payments.status, ["matched", "reversed"]);

export const instalmentFields = {
  id: instalments.id,
  studentId: instalments.studentId,
  sequence: instalments.sequence,
  dueDate: instalments.dueDate,
  amount: instalments.amountPaise,
  paid: paidSum,
};

export function instalmentsOf(studentId: string) {
  return db
    .select(instalmentFields)
    .from(instalments)
    .leftJoin(payments, eq(payments.instalmentId, instalments.id))
    .where(eq(instalments.studentId, studentId))
    .groupBy(instalments.id)
    .orderBy(asc(instalments.sequence));
}

export async function instalmentById(id: string) {
  if (!isUuid(id)) return null;

  const [row] = await db
    .select(instalmentFields)
    .from(instalments)
    .leftJoin(payments, eq(payments.instalmentId, instalments.id))
    .where(eq(instalments.id, id))
    .groupBy(instalments.id);
  return row ?? null;
}

export function matchedPaymentsOf(studentId: string) {
  return db
    .select({
      id: payments.id,
      instalmentId: payments.instalmentId,
      receiptNo: payments.receiptNo,
    })
    .from(payments)
    .innerJoin(instalments, eq(instalments.id, payments.instalmentId))
    .where(and(eq(instalments.studentId, studentId), eq(payments.status, "matched")))
    .orderBy(asc(payments.paidAt));
}

export function instalmentsOfMany(studentIds: string[]) {
  return db
    .select(instalmentFields)
    .from(instalments)
    .leftJoin(payments, eq(payments.instalmentId, instalments.id))
    .where(inArray(instalments.studentId, studentIds))
    .groupBy(instalments.id)
    .orderBy(asc(instalments.sequence));
}

export function paymentHistoryOf(studentId: string) {
  return db
    .select({
      id: payments.id,
      sequence: instalments.sequence,
      amount: payments.amountPaise,
      method: payments.method,
      reference: sql<string>`coalesce(${payments.externalRef}, ${payments.gatewayRef})`,
      receiptNo: payments.receiptNo,
      paidAt: payments.paidAt,
      status: payments.status,
      reversedOn: payments.reversedOn,
      reversalNote: payments.reversalNote,
    })
    .from(payments)
    .innerJoin(instalments, eq(instalments.id, payments.instalmentId))
    .where(and(eq(instalments.studentId, studentId), hasReceipt))
    .orderBy(desc(payments.paidAt));
}

async function findReceipt(paymentId: string, ownerCheck?: SQL) {
  if (!isUuid(paymentId)) return null;

  const [row] = await db
    .select({
      receiptNo: payments.receiptNo,
      reference: sql<string>`coalesce(${payments.externalRef}, ${payments.gatewayRef})`,
      method: payments.method,
      amount: payments.amountPaise,
      paidAt: payments.paidAt,
      reversedOn: payments.reversedOn,
      sequence: instalments.sequence,
      studentId: students.id,
      studentName: students.name,
      studentCode: students.code,
      batch: batches.name,
    })
    .from(payments)
    .innerJoin(instalments, eq(instalments.id, payments.instalmentId))
    .innerJoin(students, eq(students.id, instalments.studentId))
    .innerJoin(batches, eq(batches.id, students.batchId))
    .where(and(eq(payments.id, paymentId), hasReceipt, ownerCheck));
  return row ?? null;
}

export type Receipt = NonNullable<Awaited<ReturnType<typeof findReceipt>>>;

/** Only returns the receipt if the student belongs to this parent. */
export const receiptFor = (paymentId: string, parentId: string) =>
  findReceipt(paymentId, eq(students.parentId, parentId));

/** For accounts staff, who can see every receipt. Call only after requireUser("accounts"). */
export const staffReceipt = (paymentId: string) => findReceipt(paymentId);
