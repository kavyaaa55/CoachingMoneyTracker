"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/components/action-form";
import { parseRupees } from "@/domain/money";
import { messages } from "@/i18n";
import { requireUser } from "@/lib/auth";
import { today } from "@/lib/clock";
import { instalmentById } from "@/lib/ledger";
import { getLocale } from "@/lib/locale";
import { MANUAL_METHODS, recordPayment } from "@/lib/payments";

const formSchema = z.object({
  studentId: z.uuid(),
  instalmentId: z.uuid(),
  attempt: z.uuid(),
  amount: z.string().max(20),
  method: z.enum(MANUAL_METHODS),
  reference: z.string().trim().max(60),
  paidOn: z.iso.date(),
});

export async function recordManualPayment(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("accounts");
  const t = messages(await getLocale()).staff.payment;

  const form = formSchema.safeParse(Object.fromEntries(formData));
  if (!form.success) return { error: t.invalid };
  const { studentId, instalmentId, attempt, amount, method, reference, paidOn } = form.data;

  const amountPaise = parseRupees(amount);
  if (!amountPaise) return { error: t.invalidAmount };
  if (paidOn > today()) return { error: t.futureDate };

  const instalment = await instalmentById(instalmentId);
  if (instalment?.studentId !== studentId) return { error: t.invalid };

  const result = await recordPayment(
    {
      // The attempt id comes from the page, so a double click counts once.
      gatewayRef: `MANUAL-${attempt}`,
      instalmentRef: instalmentId,
      amountPaise,
      paidAt: `${paidOn}T06:30:00.000Z`,
    },
    { method, externalRef: reference || null, recordedBy: user.id },
  );

  if (result.status !== "matched") return { error: t.tooHigh };
  redirect(`/staff/students/${studentId}?recorded=${result.paymentId}`);
}
