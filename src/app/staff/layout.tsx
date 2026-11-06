import { StaffNav } from "@/components/staff-nav";
import { TopBar } from "@/components/top-bar";
import { messages } from "@/i18n";
import { requireUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { getLocale } from "@/lib/locale";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("accounts");
  const locale = await getLocale();
  const t = messages(locale);

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <aside className="no-print border-b border-divider bg-surface p-4 md:w-60 md:shrink-0 md:border-r md:border-b-0">
        <p className="text-lg font-medium">{t.appName}</p>
        <p className="mt-1 text-sm text-muted">{t.staff.signedInAs(user.name)}</p>
        <StaffNav
          links={[
            { href: "/staff/dues", label: t.staff.navDues },
            { href: "/staff/students", label: t.staff.navStudents },
            { href: "/staff/reminders", label: t.staff.navReminders },
            { href: "/staff/tasks", label: t.staff.navTasks },
            { href: "/staff/upload", label: t.staff.navUpload },
            ...(env.DEMO_MODE ? [{ href: "/staff/demo", label: t.staff.navDemo }] : []),
          ]}
        />
      </aside>
      <div className="min-w-0 flex-1 px-4 py-4 md:px-8">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-6">
          <div className="no-print">
            <TopBar locale={locale} showSignOut />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
