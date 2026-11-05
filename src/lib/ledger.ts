import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { batches, instalments, payments, students } from "@/db/schema";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value: string) => UUID.test(value);

const paidSum = sql<number>`coalesce(sum(${payments.amountPaise}) filter (where ${payments.status} = 'matched'), 0)::int`;

const instalmentFields = {
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

/** Only returns the receipt if the student belongs to this parent. */
export async function receiptFor(paymentId: string, parentId: string) {
  if (!isUuid(paymentId)) return null;

  const [row] = await db
    .select({
      receiptNo: payments.receiptNo,
      gatewayRef: payments.gatewayRef,
      amount: payments.amountPaise,
      paidAt: payments.paidAt,
      sequence: instalments.sequence,
      studentName: students.name,
      studentCode: students.code,
      batch: batches.name,
    })
    .from(payments)
    .innerJoin(instalments, eq(instalments.id, payments.instalmentId))
    .innerJoin(students, eq(students.id, instalments.studentId))
    .innerJoin(batches, eq(batches.id, students.batchId))
    .where(
      and(
        eq(payments.id, paymentId),
        eq(payments.status, "matched"),
        eq(students.parentId, parentId),
      ),
    );
  return row ?? null;
}
