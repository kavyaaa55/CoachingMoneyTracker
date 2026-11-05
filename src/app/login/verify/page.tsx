import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { TextField } from "@/components/text-field";
import { TopBar } from "@/components/top-bar";
import { messages } from "@/i18n";
import { readPendingLogin } from "@/lib/auth";
import { env } from "@/lib/env";
import { getLocale } from "@/lib/locale";
import { confirmCode, resendCode } from "../actions";

export default async function VerifyPage() {
  const { phone, demoCode } = await readPendingLogin();
  if (!phone) redirect("/login");

  const locale = await getLocale();
  const t = messages(locale);

  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col gap-10 px-4 py-4">
      <TopBar locale={locale} />
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-[32px] leading-10 font-medium">{t.verify.title}</h1>
          <p className="mt-2 text-muted">{t.verify.sentTo(phone.slice(-4))}</p>
        </div>
        {env.DEMO_MODE && (
          <p className="rounded-md bg-highlight px-4 py-3">
            {demoCode ? (
              <>
                {t.verify.demoCode} <strong className="font-medium">{demoCode}</strong>
              </>
            ) : (
              t.verify.demoNoCode
            )}
          </p>
        )}
        <ActionForm action={confirmCode} label={t.verify.confirm} pendingLabel={t.verify.confirming}>
          <TextField
            name="code"
            label={t.verify.codeLabel}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
          />
        </ActionForm>
      </div>
      <div className="flex flex-col items-center">
        <ActionForm action={resendCode} label={t.verify.resend} variant="link" />
        <Link href="/login" className="min-h-12 px-2 py-3 font-medium underline underline-offset-4">
          {t.verify.changeNumber}
        </Link>
      </div>
    </main>
  );
}
