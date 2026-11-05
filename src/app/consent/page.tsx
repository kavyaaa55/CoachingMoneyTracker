import { redirect } from "next/navigation";
import { signOut } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { TopBar } from "@/components/top-bar";
import { missingConsents } from "@/domain/access";
import { messages } from "@/i18n";
import { requireUser } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { childrenOf, consentedStudentIds } from "@/lib/students";
import { giveConsent } from "./actions";

export default async function ConsentPage() {
  const user = await requireUser("parent");
  const children = await childrenOf(user.id);
  const missing = missingConsents(
    children.map((child) => child.id),
    await consentedStudentIds(user.id),
  );
  if (missing.length === 0) redirect("/parent");

  const locale = await getLocale();
  const t = messages(locale);
  const sections = [
    { title: t.consent.usesTitle, body: t.consent.uses },
    { title: t.consent.whyTitle, body: t.consent.why },
    { title: t.consent.choiceTitle, body: t.consent.choice },
  ];

  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col gap-8 px-4 py-4">
      <TopBar locale={locale} />
      <div>
        <h1 className="text-[32px] leading-10 font-medium">{t.consent.title}</h1>
        <p className="mt-3 text-muted">{t.consent.intro}</p>
      </div>
      <div>
        <h2 className="font-medium">{t.consent.childrenLabel}</h2>
        <ul className="mt-1">
          {children.map((child) => (
            <li key={child.id}>{child.name}</li>
          ))}
        </ul>
      </div>
      {sections.map((section) => (
        <div key={section.title}>
          <h2 className="font-medium">{section.title}</h2>
          <p className="mt-1 text-muted">{section.body}</p>
        </div>
      ))}
      <div className="flex flex-col gap-3 pb-4">
        <ActionForm action={giveConsent} label={t.consent.confirm} pendingLabel={t.consent.saving} />
        <form action={signOut}>
          <SubmitButton label={t.consent.decline} variant="secondary" />
        </form>
      </div>
    </main>
  );
}
