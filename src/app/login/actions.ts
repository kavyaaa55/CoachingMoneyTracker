"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import type { FormState } from "@/components/action-form";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { homeFor } from "@/domain/access";
import { isOtpFormat, normalisePhone } from "@/domain/otp";
import { messages } from "@/i18n";
import {
  clearPendingLogin,
  readPendingLogin,
  savePendingLogin,
  startSession,
} from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { requestOtp, verifyOtp } from "@/lib/otp-service";
import { clientIp, withinLimit } from "@/lib/rate-limit";

async function sendCode(phone: string): Promise<FormState> {
  const t = messages(await getLocale());
  if (!(await withinLimit(`otp-request:${await clientIp()}`))) return { error: t.login.tooManyCodes };

  const result = await requestOtp(phone);

  if (result.status === "rate-limited") return { error: t.login.tooManyCodes };

  await savePendingLogin(phone, result.code);
  redirect("/login/verify");
}

export async function requestCode(_: FormState, formData: FormData): Promise<FormState> {
  const t = messages(await getLocale());
  const phone = normalisePhone(String(formData.get("phone") ?? ""));

  if (!phone) return { error: t.login.invalidPhone };
  return sendCode(phone);
}

export async function resendCode(): Promise<FormState> {
  const { phone } = await readPendingLogin();
  if (!phone) redirect("/login");
  return sendCode(phone);
}

export async function confirmCode(_: FormState, formData: FormData): Promise<FormState> {
  const locale = await getLocale();
  const t = messages(locale);
  const { phone } = await readPendingLogin();
  if (!phone) redirect("/login");

  if (!(await withinLimit(`otp-verify:${await clientIp()}`))) return { error: t.verify.locked };

  const code = String(formData.get("code") ?? "").trim();
  if (!isOtpFormat(code)) return { error: t.verify.wrong };

  const result = await verifyOtp(phone, code);
  if (result !== "ok") return { error: t.verify[result] };

  const [user] = await db
    .update(users)
    .set({ language: locale })
    .where(eq(users.phone, phone))
    .returning();
  if (!user) return { error: t.verify.wrong };

  await startSession(user);
  await clearPendingLogin();
  redirect(homeFor(user.role));
}
