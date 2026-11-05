"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/components/action-form";
import { messages } from "@/i18n";
import { requireUser } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { reviewTask, runRiskCheck } from "@/lib/risk";

const formSchema = z.object({
  taskId: z.uuid(),
  outcome: z.enum(["called", "false_flag"]),
  note: z.string().trim().max(300),
});

export async function runRiskCheckNow() {
  await requireUser("accounts");
  const { checked, flagged, notEnoughData } = await runRiskCheck();

  redirect(`/staff/tasks?checked=${checked}&flagged=${flagged}&thin=${notEnoughData}`);
}

export async function reviewCallTask(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("accounts");
  const t = messages(await getLocale()).staff.tasks;

  const form = formSchema.safeParse(Object.fromEntries(formData));
  if (!form.success) return { error: t.invalid };
  const { taskId, outcome, note } = form.data;

  if (outcome === "false_flag" && !note) return { error: t.noteNeeded };

  await reviewTask({ taskId, outcome, note: note || null, reviewedBy: user.id });

  // Also when it was already closed, as after a double click: the list shows the truth.
  redirect(`/staff/tasks?saved=${outcome}`);
}
