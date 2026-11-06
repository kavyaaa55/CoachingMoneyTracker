import { and, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { instalments, monthCloses, payments, reminders, students } from "@/db/schema";
import type { IsoDate } from "@/domain/dates";
import { matchPayment } from "@/domain/payments";
import { audit } from "./audit";
import { istDate, today } from "./clock";
import { isUuid } from "./ledger";

export const paymentEventSchema = z.object({
  gatewayRef: z.string().min(1).max(100),
  instalmentRef: z.string().max(100).nullable(),
  amountPaise: z.number().int().positive(),
  paidAt: z.iso.datetime(),
  /** What the payer wrote, if the gateway passes it on. */
  note: z.string().trim().max(200).optional(),
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
  status: "matched" | "unmatched" | "reversed" | "returned" | "rejected";
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
 * This file is the only code that marks an instalment paid. Safe to call twice with one event:
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
        payerNote: event.note ?? null,
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

    if (inserted && manual) {
      await audit(tx, {
        actorId: manual.recordedBy,
        action: "payment.manual",
        entityId: inserted.id,
        detail: { receipt: inserted.receiptNo, amountPaise: inserted.amountPaise },
      });
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

export async function isMonthClosed(date: IsoDate) {
  const [closed] = await db
    .select({ id: monthCloses.id })
    .from(monthCloses)
    .where(eq(monthCloses.month, date.slice(0, 7)));
  return Boolean(closed);
}

export type ApplyOutcome = "applied" | "not-queued" | "does-not-fit" | "month-closed";

type ApplyQueued = { paymentId: string; instalmentId: string; appliedBy: string };

/**
 * A person confirms where queued money belongs. recordPayment cannot do this, because a repeat of
 * a gateway reference returns the old row, so this takes the same lock and the same matching rule.
 */
export async function applyQueuedPayment({
  paymentId,
  instalmentId,
  appliedBy,
}: ApplyQueued): Promise<ApplyOutcome> {
  return db.transaction(async (tx) => {
    const [instalment] = await tx
      .select()
      .from(instalments)
      .where(eq(instalments.id, instalmentId))
      .for("update");
    if (!instalment) return "does-not-fit";

    const [payment] = await tx.select().from(payments).where(eq(payments.id, paymentId)).for("update");
    if (payment?.status !== "unmatched") return "not-queued";
    if (await isMonthClosed(istDate(payment.paidAt))) return "month-closed";

    const [{ paid }] = await tx
      .select({ paid: sql<number>`coalesce(sum(${payments.amountPaise}), 0)::int` })
      .from(payments)
      .where(and(eq(payments.instalmentId, instalmentId), eq(payments.status, "matched")));
    const balance = Math.max(0, instalment.amountPaise - paid);

    const [student] = await tx
      .select({ exitDate: students.exitDate })
      .from(students)
      .where(eq(students.id, instalment.studentId));

    const match = matchPayment(balance, payment.amountPaise, student.exitDate !== null);
    if (match.status !== "matched") return "does-not-fit";

    const [applied] = await tx
      .update(payments)
      .set({
        status: "matched",
        instalmentId,
        appliedBy,
        unmatchedReason: null,
        receiptNo: sql`'RCT-' || lpad(nextval('receipt_no_seq')::text, 6, '0')`,
      })
      .where(eq(payments.id, paymentId))
      .returning();

    if (payment.amountPaise === balance) {
      await tx
        .update(reminders)
        .set({ status: "stopped", stoppedReason: "paid" })
        .where(and(eq(reminders.instalmentId, instalmentId), eq(reminders.status, "queued")));
    }

    await audit(tx, {
      actorId: appliedBy,
      action: "payment.applied",
      entityId: paymentId,
      detail: {
        reference: payment.gatewayRef,
        receipt: applied.receiptNo,
        amountPaise: payment.amountPaise,
      },
    });
    return "applied";
  });
}

type ReturnQueued = { paymentId: string; note: string; returnedBy: string };

/**
 * Money that belongs on no fee, such as an overpayment or a payment for a student who has left.
 * It leaves the queue with a reason, so a month can close, and the row stays as the record.
 */
export async function returnQueuedPayment(
  { paymentId, note, returnedBy }: ReturnQueued,
  date: IsoDate = today(),
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const updated = await tx
      .update(payments)
      .set({ status: "returned", reversedBy: returnedBy, reversedOn: date, reversalNote: note })
      .where(and(eq(payments.id, paymentId), eq(payments.status, "unmatched")))
      .returning();
    if (updated.length === 0) return false;

    await audit(tx, {
      actorId: returnedBy,
      action: "payment.returned",
      entityId: paymentId,
      detail: {
        reference: updated[0].gatewayRef,
        amountPaise: updated[0].amountPaise,
        note,
      },
    });
    return true;
  });
}

export type ReverseOutcome = "reversed" | "not-found" | "not-matched" | "student-left";

type Reversal = { paymentId: string; note: string; reversedBy: string };

/** Undoes a payment with a new entry. Nothing is deleted, and the receipt stays as cancelled. */
export async function reversePayment(
  { paymentId, note, reversedBy }: Reversal,
  date: IsoDate = today(),
): Promise<ReverseOutcome> {
  return db.transaction(async (tx) => {
    const [found] = await tx.select().from(payments).where(eq(payments.id, paymentId));
    if (!found) return "not-found";
    if (!found.instalmentId) return "not-matched";

    // The same lock as every other change to this instalment's balance.
    const [instalment] = await tx
      .select()
      .from(instalments)
      .where(eq(instalments.id, found.instalmentId))
      .for("update");

    const [payment] = await tx.select().from(payments).where(eq(payments.id, paymentId));
    if (payment.status !== "matched") return "not-matched";

    // A saved refund used this money, so taking it back would make the refund wrong.
    const [student] = await tx
      .select({ exitDate: students.exitDate })
      .from(students)
      .where(eq(students.id, instalment.studentId));
    if (student.exitDate) return "student-left";

    await tx
      .update(payments)
      .set({ status: "reversed", reversedBy, reversedOn: date, reversalNote: note })
      .where(eq(payments.id, paymentId));

    // Stages still ahead come back. Ones already past stay stopped, so nothing old is sent.
    await tx
      .update(reminders)
      .set({ status: "queued", stoppedReason: null })
      .where(
        and(
          eq(reminders.instalmentId, instalment.id),
          eq(reminders.status, "stopped"),
          eq(reminders.stoppedReason, "paid"),
          gt(reminders.sendOn, date),
        ),
      );

    await audit(tx, {
      actorId: reversedBy,
      action: "payment.reversed",
      entityId: paymentId,
      detail: { receipt: payment.receiptNo, amountPaise: payment.amountPaise, note },
    });
    return "reversed";
  });
}
