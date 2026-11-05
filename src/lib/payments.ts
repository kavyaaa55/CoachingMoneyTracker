import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { instalments, payments, reminders, students } from "@/db/schema";
import { matchPayment } from "@/domain/payments";
import { isUuid } from "./ledger";

export const paymentEventSchema = z.object({
  gatewayRef: z.string().min(1).max(100),
  instalmentRef: z.string().max(100).nullable(),
  amountPaise: z.number().int().positive(),
  paidAt: z.iso.datetime(),
});

export const MANUAL_METHODS = ["cash", "upi", "cheque", "bank_transfer"] as const;

export type PaymentEvent = z.infer<typeof paymentEventSchema>;

type ManualDetails = {
  method: (typeof MANUAL_METHODS)[number];
  externalRef: string | null;
  recordedBy: string;
};

export type RecordedPayment = {
  paymentId: string | null;
  status: "matched" | "unmatched" | "rejected";
  duplicate: boolean;
  studentId: string | null;
};

type Row = typeof payments.$inferSelect;

async function toResult(row: Row, duplicate: boolean): Promise<RecordedPayment> {
  const [owner] = row.instalmentId
    ? await db
        .select({ studentId: instalments.studentId })
        .from(instalments)
        .where(eq(instalments.id, row.instalmentId))
    : [];

  return {
    paymentId: row.id,
    status: row.status,
    duplicate,
    studentId: owner?.studentId ?? null,
  };
}

/**
 * The only code that marks an instalment paid. Safe to call twice with the same event:
 * gateway_ref is unique, so a repeat returns the first result and changes nothing.
 *
 * Gateway money has really arrived, so a mismatch is kept in the queue. A manual entry
 * that does not match is a typing mistake, so passing `manual` rejects it and saves nothing.
 */
export async function recordPayment(
  event: PaymentEvent,
  manual?: ManualDetails,
): Promise<RecordedPayment> {
  const outcome = await db.transaction(async (tx) => {
    const findExisting = () =>
      tx.select().from(payments).where(eq(payments.gatewayRef, event.gatewayRef));

    const [existing] = await findExisting();
    if (existing) return { row: existing, duplicate: true };

    const claimedId =
      event.instalmentRef && isUuid(event.instalmentRef) ? event.instalmentRef : null;

    // Lock the instalment so two payments cannot both be checked against the same balance.
    const [instalment] = claimedId
      ? await tx.select().from(instalments).where(eq(instalments.id, claimedId)).for("update")
      : [];

    let balance: number | null = null;
    let studentHasLeft = false;
    if (instalment) {
      const [{ paid }] = await tx
        .select({ paid: sql<number>`coalesce(sum(${payments.amountPaise}), 0)::int` })
        .from(payments)
        .where(and(eq(payments.instalmentId, instalment.id), eq(payments.status, "matched")));
      balance = Math.max(0, instalment.amountPaise - paid);

      // Read after the lock: saving a refund takes the same lock before it sets this.
      const [student] = await tx
        .select({ exitDate: students.exitDate })
        .from(students)
        .where(eq(students.id, instalment.studentId));
      studentHasLeft = student.exitDate !== null;
    }

    const match = matchPayment(balance, event.amountPaise, studentHasLeft);
    const matched = match.status === "matched";
    if (!matched && manual) return null;

    const [inserted] = await tx
      .insert(payments)
      .values({
        gatewayRef: event.gatewayRef,
        instalmentId: matched ? instalment.id : null,
        amountPaise: event.amountPaise,
        status: match.status,
        ...manual,
        receiptNo: matched
          ? sql`'RCT-' || lpad(nextval('receipt_no_seq')::text, 6, '0')`
          : null,
        claimedRef: event.instalmentRef,
        unmatchedReason: matched ? null : match.reason,
        paidAt: new Date(event.paidAt),
      })
      .onConflictDoNothing({ target: payments.gatewayRef })
      .returning();

    if (inserted && matched && event.amountPaise === balance) {
      // Fully paid: stop what is queued in the same step, so no reminder can follow.
      await tx
        .update(reminders)
        .set({ status: "stopped", stoppedReason: "paid" })
        .where(and(eq(reminders.instalmentId, instalment.id), eq(reminders.status, "queued")));
    }

    if (inserted) return { row: inserted, duplicate: false };

    const [winner] = await findExisting();
    return { row: winner, duplicate: true };
  });

  if (!outcome) {
    return { paymentId: null, status: "rejected", duplicate: false, studentId: null };
  }
  return toResult(outcome.row, outcome.duplicate);
}
