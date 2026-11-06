import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  batches,
  centres,
  instalments,
  payments,
  refunds,
  reminders,
  students,
} from "@/db/schema";
import type { IsoDate } from "@/domain/dates";
import { calculateRefund, canSaveExit, isPlausibleExitDate, refundStage } from "@/domain/refund";
import { today } from "./clock";
import { isUuid } from "./ledger";

export type SaveRefundOutcome =
  | "saved"
  | "not-found"
  | "already-saved"
  | "future-date"
  | "invalid-date";

type SaveRefund = { studentId: string; exitDate: IsoDate; createdBy: string };

/** Everything the amount depends on is read here, never taken from the form. */
export async function saveRefund(
  { studentId, exitDate, createdBy }: SaveRefund,
  date: IsoDate = today(),
): Promise<SaveRefundOutcome> {
  return db.transaction(async (tx) => {
    const [student] = await tx
      .select()
      .from(students)
      .where(eq(students.id, studentId))
      .for("update");

    if (!student) return "not-found";
    if (student.exitDate) return "already-saved";
    if (!isPlausibleExitDate(exitDate, student.termStart, student.termEnd)) return "invalid-date";
    if (!canSaveExit(exitDate, date)) return "future-date";

    // The same lock recordPayment and the reminder job take. A payment or a send in
    // progress finishes first and is counted, and any that follow see the exit date.
    const owned = await tx
      .select({ id: instalments.id })
      .from(instalments)
      .where(eq(instalments.studentId, studentId))
      .orderBy(asc(instalments.sequence))
      .for("update");
    const instalmentIds = owned.map((item) => item.id);

    const [{ paid }] = await tx
      .select({ paid: sql<number>`coalesce(sum(${payments.amountPaise}), 0)::int` })
      .from(payments)
      .where(and(inArray(payments.instalmentId, instalmentIds), eq(payments.status, "matched")));

    const netFee = student.planTotalPaise - student.discountPaise;
    const result = calculateRefund({
      netFee,
      paid,
      termStart: student.termStart,
      termEnd: student.termEnd,
      exitDate,
    });

    await tx.insert(refunds).values({
      studentId,
      exitDate,
      netFeePaise: netFee,
      paidPaise: paid,
      termDays: result.termDays,
      daysUsed: result.daysUsed,
      feeUsedPaise: result.feeUsed,
      refundPaise: result.refund,
      dueBy: result.dueBy,
      createdBy,
    });

    await tx.update(students).set({ exitDate }).where(eq(students.id, studentId));

    await tx
      .update(reminders)
      .set({ status: "stopped", stoppedReason: "student-left" })
      .where(and(inArray(reminders.instalmentId, instalmentIds), eq(reminders.status, "queued")));

    return "saved";
  });
}

export type ApproveOutcome = "approved" | "not-found" | "same-person" | "not-waiting";

/** The person who saved a refund cannot approve it. The database refuses it too. */
export async function approveRefund(
  { refundId, approvedBy }: { refundId: string; approvedBy: string },
  date: IsoDate = today(),
): Promise<ApproveOutcome> {
  return db.transaction(async (tx) => {
    const [refund] = await tx.select().from(refunds).where(eq(refunds.id, refundId)).for("update");

    if (!refund) return "not-found";
    if (refundStage(refund.refundPaise, refund.status) !== "to-approve") return "not-waiting";
    if (refund.createdBy === approvedBy) return "same-person";

    await tx
      .update(refunds)
      .set({ status: "approved", approvedBy, approvedOn: date })
      .where(eq(refunds.id, refundId));
    return "approved";
  });
}

type MarkPaid = {
  refundId: string;
  paidBy: string;
  paidOn: IsoDate;
  method: (typeof REFUND_METHODS)[number];
  reference: string;
};

export type MarkPaidOutcome = "paid" | "not-found" | "not-approved" | "bad-date";

export const REFUND_METHODS = ["upi", "cheque", "bank_transfer"] as const;

/** Paying out issues the credit note, so the two can never disagree. */
export async function markRefundPaid(
  { refundId, paidBy, paidOn, method, reference }: MarkPaid,
  date: IsoDate = today(),
): Promise<MarkPaidOutcome> {
  return db.transaction(async (tx) => {
    const [refund] = await tx.select().from(refunds).where(eq(refunds.id, refundId)).for("update");

    if (!refund) return "not-found";
    if (refundStage(refund.refundPaise, refund.status) !== "to-pay") return "not-approved";
    if (paidOn > date || paidOn < refund.exitDate) return "bad-date";

    await tx
      .update(refunds)
      .set({
        status: "paid",
        paidBy,
        paidOn,
        paidMethod: method,
        paidRef: reference,
        creditNoteNo: sql`'CN-' || lpad(nextval('credit_note_no_seq')::text, 6, '0')`,
      })
      .where(eq(refunds.id, refundId));
    return "paid";
  });
}

export function listRefunds() {
  return db
    .select({
      id: refunds.id,
      studentId: students.id,
      studentName: students.name,
      studentCode: students.code,
      batch: batches.name,
      centre: centres.name,
      refund: refunds.refundPaise,
      status: refunds.status,
      exitDate: refunds.exitDate,
      dueBy: refunds.dueBy,
      paidOn: refunds.paidOn,
    })
    .from(refunds)
    .innerJoin(students, eq(students.id, refunds.studentId))
    .innerJoin(batches, eq(batches.id, students.batchId))
    .innerJoin(centres, eq(centres.id, batches.centreId))
    .orderBy(asc(refunds.dueBy));
}

export async function creditNote(refundId: string) {
  if (!isUuid(refundId)) return null;

  const [row] = await db
    .select({
      number: refunds.creditNoteNo,
      amount: refunds.refundPaise,
      paidOn: refunds.paidOn,
      method: refunds.paidMethod,
      reference: refunds.paidRef,
      exitDate: refunds.exitDate,
      studentId: students.id,
      studentName: students.name,
      studentCode: students.code,
      batch: batches.name,
    })
    .from(refunds)
    .innerJoin(students, eq(students.id, refunds.studentId))
    .innerJoin(batches, eq(batches.id, students.batchId))
    .where(eq(refunds.id, refundId));
  return row?.number ? row : null;
}

export async function refundOf(studentId: string) {
  if (!isUuid(studentId)) return null;

  const [row] = await db.select().from(refunds).where(eq(refunds.studentId, studentId));
  return row ?? null;
}
