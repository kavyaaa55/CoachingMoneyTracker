import { redirect } from "next/navigation";
import { setLanguage } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { TextField } from "@/components/text-field";
import { TopBar } from "@/components/top-bar";
import { homeFor } from "@/domain/access";
import { messages } from "@/i18n";
import { currentUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { chosenLocale } from "@/lib/locale";
import { requestCode } from "./actions";

export default async function LoginPage() {
  const user = await currentUser();
  if (user) redirect(homeFor(user.role));

  const locale = await chosenLocale();

  if (!locale) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col justify-center gap-6 px-4 py-12">
        <h1 className="text-[32px] leading-10 font-medium">
          <span lang="hi">भाषा चुनें</span>
          <span className="block text-xl leading-8 text-muted">Choose your language</span>
        </h1>
        <div className="flex flex-col gap-4">
          <form action={setLanguage}>
            <input type="hidden" name="locale" value="hi" />
            <SubmitButton label="हिन्दी" />
          </form>
          <form action={setLanguage}>
            <input type="hidden" name="locale" value="en" />
            <SubmitButton label="English" />
          </form>
        </div>
      </main>
    );
  }

  const t = messages(locale);
  const demoNumbers = [
    { label: t.login.demoParentHindi, phone: "9000000002" },
    { label: t.login.demoParentEnglish, phone: "9000000001" },
    { label: t.login.demoParentTwo, phone: "9000001035" },
    { label: t.login.demoStaff, phone: "9000000100" },
  ];

  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col gap-10 px-4 py-4">
      <TopBar locale={locale} />
      <div className="flex flex-col gap-6">
        <h1 className="text-[32px] leading-10 font-medium">{t.login.title}</h1>
        <ActionForm action={requestCode} label={t.login.sendCode} pendingLabel={t.login.sending}>
          <TextField
            name="phone"
            type="tel"
            label={t.login.phoneLabel}
            hint={t.login.phoneHint}
            inputMode="numeric"
            autoComplete="tel-national"
            maxLength={16}
            autoFocus
          />
        </ActionForm>
      </div>
      {env.DEMO_MODE && (
        <section className="rounded-md border border-divider bg-surface p-4">
          <h2 className="font-medium">{t.login.demoTitle}</h2>
          <dl className="mt-2 text-sm">
            {demoNumbers.map((item) => (
              <div key={item.phone} className="flex justify-between gap-4 py-1">
                <dt className="text-muted">{item.label}</dt>
                <dd>{item.phone}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </main>
  );
}
