import Link from "next/link";
import { TopBar } from "@/components/top-bar";
import { percentOf, recentAttendance } from "@/domain/progress";
import { formatDate, messages } from "@/i18n";
import { requireParent } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { attendanceOf, scoresOf } from "@/lib/progress";

export default async function ProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string }>;
}) {
  const { children } = await requireParent();
  const { student } = await searchParams;
  const locale = await getLocale();
  const t = messages(locale);
  const p = t.progress;

  // Only ever a child of this parent. Anything else falls back to their own first child.
  const child = children.find((item) => item.id === student) ?? children[0];
  const [weeks, scores] = child
    ? await Promise.all([attendanceOf(child.id), scoresOf(child.id)])
    : [[], []];
  const recent = recentAttendance(weeks);

  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col gap-6 px-4 py-4">
      <TopBar locale={locale} showSignOut />
      <div>
        <Link
          href={child ? `/parent/instalments?student=${child.id}` : "/parent"}
          className="inline-block min-h-12 py-3 font-medium underline underline-offset-4"
        >
          {t.instalments.back}
        </Link>
        <h1 className="text-[32px] leading-10 font-medium">{p.title}</h1>
        {child && <p className="mt-1 text-muted">{child.name}</p>}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl leading-7 font-medium">{p.attendanceTitle}</h2>
        {recent ? (
          <>
            <p>{p.recent(recent.weeks, recent.present, recent.total, recent.percent)}</p>
            <ul className="divide-y divide-divider rounded-md border border-divider bg-surface">
              {weeks.map((week) => (
                <li key={week.weekStart} className="flex items-baseline justify-between gap-4 p-4">
                  <span>{p.weekOf(formatDate(week.weekStart, locale))}</span>
                  <span className="whitespace-nowrap">{p.classes(week.present, week.total)}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="rounded-md border border-divider bg-surface p-4 text-muted">
            {p.attendanceEmpty}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3 pb-8">
        <h2 className="text-xl leading-7 font-medium">{p.testsTitle}</h2>
        {scores.length > 0 ? (
          <ul className="divide-y divide-divider rounded-md border border-divider bg-surface">
            {scores.map((test) => (
              <li key={test.testName} className="flex items-baseline justify-between gap-4 p-4">
                <span className="min-w-0">
                  <span className="block break-words">{test.testName}</span>
                  <span className="block text-sm text-muted">
                    {formatDate(test.takenOn, locale)}
                  </span>
                </span>
                <span className="text-right whitespace-nowrap">
                  <span className="block font-medium">
                    {p.score(test.score, test.maxScore)}
                  </span>
                  <span className="block text-sm text-muted">
                    {percentOf(test.score, test.maxScore)}%
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-md border border-divider bg-surface p-4 text-muted">
            {p.testsEmpty}
          </p>
        )}
      </section>
    </main>
  );
}
