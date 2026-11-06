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

  // Grouped once, because filtering per student was quadratic at real size.
  const instalmentsBy = Map.groupBy(instalmentRows, (row) => row.studentId);
  const paymentsBy = Map.groupBy(paymentRows, (row) => row.instalmentId);
  const attendanceBy = Map.groupBy(attendanceRows, (row) => row.studentId);
  const scoresBy = Map.groupBy(scoreRows, (row) => row.studentId);

  const list = studentRows.map((student) => ({
    code: student.code,
    name: student.name,
    batchId: student.batchId,
    exitDate: student.exitDate,
    instalments: (instalmentsBy.get(student.id) ?? []).map((item) => ({
      dueDate: item.dueDate,
      amount: item.amountPaise,
      payments: (paymentsBy.get(item.id) ?? []).map((payment) => ({
        amount: payment.amount,
        paidOn: istDate(payment.paidAt),
      })),
    })),
    attendance: attendanceBy.get(student.id) ?? [],
    scores: scoresBy.get(student.id) ?? [],
  }));

  const termStart = studentRows.map((row) => row.termStart).sort()[0] ?? "";
  return { students: list, termStart };
}

export const allReviews = () =>
  db
    .select({ code: students.code, status: riskFlags.taskStatus, reasons: riskFlags.reasons })
    .from(riskFlags)
    .innerJoin(students, eq(students.id, riskFlags.studentId));
