import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { instalments, payments, refunds, reminders, students } from "@/db/schema";
import type { IsoDate } from "@/domain/dates";
import { calculateRefund, canSaveExit, isPlausibleExitDate } from "@/domain/refund";
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

export async function refundOf(studentId: string) {
  if (!isUuid(studentId)) return null;

  const [row] = await db.select().from(refunds).where(eq(refunds.studentId, studentId));
  return row ?? null;
}
