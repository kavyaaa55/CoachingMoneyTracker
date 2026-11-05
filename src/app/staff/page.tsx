import { count } from "drizzle-orm";
import { TopBar } from "@/components/top-bar";
import { db } from "@/db/client";
import { centres, students } from "@/db/schema";
import { messages } from "@/i18n";
import { requireUser } from "@/lib/auth";
import { getLocale } from "@/lib/locale";

export default async function StaffHome() {
  const user = await requireUser("accounts");
  const locale = await getLocale();
  const t = messages(locale);

  const [[studentTotal], [centreTotal]] = await Promise.all([
    db.select({ total: count() }).from(students),
    db.select({ total: count() }).from(centres),
  ]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-[1180px] flex-col gap-8 px-4 py-4">
      <TopBar locale={locale} showSignOut />
      <div>
        <h1 className="text-[32px] leading-10 font-medium">{t.staff.title}</h1>
        <p className="mt-2 text-muted">{t.staff.signedInAs(user.name)}</p>
        <p className="mt-4">{t.staff.summary(studentTotal.total, centreTotal.total)}</p>
      </div>
    </main>
  );
}
