import { TopBar } from "@/components/top-bar";
import { messages } from "@/i18n";
import { requireParent } from "@/lib/auth";
import { getLocale } from "@/lib/locale";

export default async function ParentHome() {
  const { children } = await requireParent();
  const locale = await getLocale();
  const t = messages(locale);

  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col gap-8 px-4 py-4">
      <TopBar locale={locale} showSignOut />
      <div>
        <h1 className="text-[32px] leading-10 font-medium">{t.parent.childrenTitle}</h1>
        {children.length === 0 ? (
          <p className="mt-3 text-muted">{t.parent.noChildren}</p>
        ) : (
          <ul className="mt-4 divide-y divide-divider">
            {children.map((child) => (
              <li key={child.id} className="py-3">
                <p className="text-lg font-medium">{child.name}</p>
                <p className="text-muted">
                  {child.batch} · {child.centre}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
