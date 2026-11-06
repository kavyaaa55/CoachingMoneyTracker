"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/components/action-form";
import { messages } from "@/i18n";
import { requireUser } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { approveRefund, markRefundPaid, REFUND_METHODS, saveRefund } from "@/lib/refunds";

const formSchema = z.object({
  studentId: z.uuid(),
  exitDate: z.iso.date(),
});

const stepSchema = z.object({ studentId: z.uuid(), refundId: z.uuid() });
const paidSchema = stepSchema.extend({
  method: z.enum(REFUND_METHODS),
  reference: z.string().trim().min(1).max(60),
  paidOn: z.iso.date(),
});

export async function approveStudentRefund(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("accounts");
  const t = messages(await getLocale()).staff.refund.steps;

  const form = stepSchema.safeParse(Object.fromEntries(formData));
  if (!form.success) return { error: t.invalid };

  const outcome = await approveRefund({ refundId: form.data.refundId, approvedBy: user.id });
  if (outcome === "same-person") return { error: t.samePerson };
  if (outcome === "not-found") return { error: t.invalid };

  redirect(`/staff/students/${form.data.studentId}/refund`);
}

export async function payStudentRefund(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("accounts");
  const t = messages(await getLocale()).staff.refund.steps;

  const form = paidSchema.safeParse(Object.fromEntries(formData));
  if (!form.success) return { error: t.needReference };
  const { studentId, refundId, method, reference, paidOn } = form.data;

  const outcome = await markRefundPaid({ refundId, paidBy: user.id, paidOn, method, reference });
  if (outcome === "bad-date") return { error: t.badDate };
  if (outcome === "not-found" || outcome === "not-approved") return { error: t.invalid };

  redirect(`/staff/students/${studentId}/refund`);
}

export async function saveStudentRefund(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("accounts");
  const t = messages(await getLocale()).staff.refund;

  const form = formSchema.safeParse(Object.fromEntries(formData));
  if (!form.success) return { error: t.invalidDate };
  const { studentId, exitDate } = form.data;

  const outcome = await saveRefund({ studentId, exitDate, createdBy: user.id });

  if (outcome === "future-date") return { error: t.futureDate };
  if (outcome === "invalid-date" || outcome === "not-found") return { error: t.invalidDate };

  // Also for "already-saved", as after a double click: the page shows what was saved.
  redirect(`/staff/students/${studentId}/refund`);
}
