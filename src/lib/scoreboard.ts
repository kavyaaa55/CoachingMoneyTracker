import { and, asc, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { batches, centres, instalments, payments, reminders, students } from "@/db/schema";
import { daysBetween, type IsoDate } from "@/domain/dates";
import { paidAfterReminder, type ScoredInstalment } from "@/domain/scoreboard";
import { istDate, today } from "./clock";

/** Students who have left are not counted, the same as the dues figures. */
export async function scoredInstalments(): Promise<ScoredInstalment[]> {
  const rows = await db
    .select({
      id: instalments.id,
      dueDate: instalments.dueDate,
      amount: instalments.amountPaise,
      centre: centres.name,
      paid: payments.amountPaise,
      paidAt: payments.paidAt,
    })
    .from(instalments)
    .innerJoin(students, eq(students.id, instalments.studentId))
    .innerJoin(batches, eq(batches.id, students.batchId))
    .innerJoin(centres, eq(centres.id, batches.centreId))
    .leftJoin(
      payments,
      and(eq(payments.instalmentId, instalments.id), eq(payments.status, "matched")),
    )
    .where(isNull(students.exitDate));

  const byId = new Map<string, ScoredInstalment>();
  for (const { id, dueDate, amount, centre, paid, paidAt } of rows) {
    const item = byId.get(id) ?? { dueDate, amount, centre, payments: [] };
    if (paid !== null && paidAt) item.payments.push({ amount: paid, paidOn: istDate(paidAt) });
    byId.set(id, item);
  }
  return [...byId.values()];
}

export async function reminderResponse() {
  const [sent, paid] = await Promise.all([
    db
      .select({ instalmentId: reminders.instalmentId, sentOn: reminders.sendOn })
      .from(reminders)
      .where(eq(reminders.status, "sent")),
    db
      .select({ instalmentId: payments.instalmentId, paidAt: payments.paidAt })
      .from(payments)
      .where(and(eq(payments.status, "matched"), isNotNull(payments.instalmentId))),
  ]);

  return paidAfterReminder(
    sent,
    paid.map((row) => ({ instalmentId: row.instalmentId!, paidOn: istDate(row.paidAt) })),
  );
}

/** How much of the month-end work the matching rules have already done. */
export async function matchingHealth(date: IsoDate = today()) {
  const rows = await db
    .select({ status: payments.status, method: payments.method, paidAt: payments.paidAt })
    .from(payments)
    .orderBy(asc(payments.paidAt));

  const matched = rows.filter((row) => row.status === "matched");
  const queued = rows.filter((row) => row.status === "unmatched");

  return {
    matched: matched.length,
    automatic: matched.filter((row) => row.method === "gateway").length,
    queued: queued.length,
    oldestDays: queued[0] ? daysBetween(istDate(queued[0].paidAt), date) : null,
  };
}
