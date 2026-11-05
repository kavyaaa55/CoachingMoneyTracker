import { setLanguage, signOut } from "@/app/actions";
import { messages, type Locale } from "@/i18n";
import { SubmitButton } from "./submit-button";

type Props = { locale: Locale; showSignOut?: boolean };

export function TopBar({ locale, showSignOut = false }: Props) {
  const t = messages(locale);
  const other = locale === "en" ? "hi" : "en";

  return (
    <header className="flex items-center justify-between text-sm text-muted">
      <span>{t.institute}</span>
      <div className="flex items-center text-ink">
        <form action={setLanguage}>
          <input type="hidden" name="locale" value={other} />
          <SubmitButton label={other === "hi" ? "हिन्दी" : "English"} variant="link" />
        </form>
        {showSignOut && (
          <form action={signOut}>
            <SubmitButton label={t.signOut} variant="link" />
          </form>
        )}
      </div>
    </header>
  );
}
