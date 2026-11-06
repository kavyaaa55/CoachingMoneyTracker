import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { attendance, instalments, payments, riskFlags, students, testScores } from "@/db/schema";
import type { LabStudent } from "@/domain/risk-lab";
import { istDate } from "./clock";

/** Reads only. The lab has no way to change a flag, a fee or a message. */
export async function labStudents(): Promise<{ students: LabStudent[]; termStart: string }> {
  const [studentRows, instalmentRows, paymentRows, attendanceRows, scoreRows] = await Promise.all([
    db.select().from(students),
    db.select().from(instalments),
    db
      .select({
        instalmentId: payments.instalmentId,
        amount: payments.amountPaise,
        paidAt: payments.paidAt,
      })
      .from(payments)
      .where(and(eq(payments.status, "matched"))),
    db.select().from(attendance),
    db.select().from(testScores),
  ]);

  const list = studentRows.map((student) => ({
    code: student.code,
    name: student.name,
    batchId: student.batchId,
    exitDate: student.exitDate,
    instalments: instalmentRows
      .filter((item) => item.studentId === student.id)
      .map((item) => ({
        dueDate: item.dueDate,
        amount: item.amountPaise,
        payments: paymentRows
          .filter((payment) => payment.instalmentId === item.id)
          .map((payment) => ({ amount: payment.amount, paidOn: istDate(payment.paidAt) })),
      })),
    attendance: attendanceRows.filter((row) => row.studentId === student.id),
    scores: scoreRows.filter((row) => row.studentId === student.id),
  }));

  const termStart = studentRows.map((row) => row.termStart).sort()[0] ?? "";
  return { students: list, termStart };
}

export const allReviews = () =>
  db.select({ status: riskFlags.taskStatus, reasons: riskFlags.reasons }).from(riskFlags);
