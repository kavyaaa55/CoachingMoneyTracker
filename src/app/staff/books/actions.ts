"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/components/action-form";
import { messages } from "@/i18n";
import { requireUser } from "@/lib/auth";
import { closeMonth } from "@/lib/books";
import { getLocale } from "@/lib/locale";
import { applyQueuedPayment, reversePayment } from "@/lib/payments";

const applySchema = z.object({ paymentId: z.uuid(), instalmentId: z.uuid() });
const closeSchema = z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) });
const reverseSchema = z.object({
  paymentId: z.uuid(),
  studentId: z.uuid(),
  note: z.string().trim().min(3).max(300),
});

export async function applyFromQueue(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("accounts");
  const t = messages(await getLocale()).staff.books;

  const form = applySchema.safeParse(Object.fromEntries(formData));
  if (!form.success) return { error: t.invalid };

  const outcome = await applyQueuedPayment({ ...form.data, appliedBy: user.id });
  if (outcome === "month-closed") return { error: t.monthClosed };
  if (outcome !== "applied") return { error: t.doesNotFit };

  redirect("/staff/books?applied=1");
}

export async function closeThisMonth(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("accounts");
  const t = messages(await getLocale()).staff.books;

  const form = closeSchema.safeParse(Object.fromEntries(formData));
  if (!form.success) return { error: t.invalid };

  const outcome = await closeMonth({ month: form.data.month, closedBy: user.id });
  if (outcome === "checks-failed") return { error: t.checksFailed };
  if (outcome === "month-not-over") return { error: t.notOver };

  redirect(`/staff/books?month=${form.data.month}`);
}

export async function reverseFromLedger(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("accounts");
  const t = messages(await getLocale()).staff.ledger.reverse;

  const form = reverseSchema.safeParse(Object.fromEntries(formData));
  if (!form.success) return { error: t.needNote };
  const { paymentId, studentId, note } = form.data;

  const outcome = await reversePayment({ paymentId, note, reversedBy: user.id });
  if (outcome === "student-left") return { error: t.studentLeft };
  if (outcome !== "reversed") return { error: t.notAllowed };

  redirect(`/staff/students/${studentId}`);
}
