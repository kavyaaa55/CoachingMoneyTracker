"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/components/action-form";
import { messages } from "@/i18n";
import { requireUser } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { saveRefund } from "@/lib/refunds";

const formSchema = z.object({
  studentId: z.uuid(),
  exitDate: z.iso.date(),
});

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
