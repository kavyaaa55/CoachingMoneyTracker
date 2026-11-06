import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonStyles, rowLink } from "@/components/button-styles";
import { DataTable } from "@/components/data-table";
import { PipelineRuns } from "@/components/pipeline-runs";
import { SubmitButton } from "@/components/submit-button";
import { formatDate, messages } from "@/i18n";
import { requireUser } from "@/lib/auth";
import { today } from "@/lib/clock";
import { storyLinks, syncDemoClock } from "@/lib/demo";
import { env } from "@/lib/env";
import { getLocale } from "@/lib/locale";
import { recentRuns } from "@/lib/pipeline";
import { listReminders } from "@/lib/reminders";
import { moveTime, resetEverything } from "./actions";

type Query = {
  moved?: string;
  sent?: string;
  stopped?: string;
  paid?: string;
  tasks?: string;
};

const SHOWN_MESSAGES = 3;

export default async function DemoPage({ searchParams }: { searchParams: Promise<Query> }) {
  await requireUser("accounts");
  if (!env.DEMO_MODE) notFound();

  await syncDemoClock();
  const query = await searchParams;
  const locale = await getLocale();
  const t = messages(locale);
  const c = t.staff.demo;
  const date = today();

  const [story, runs, sent] = await Promise.all([
    storyLinks(),
    recentRuns(),
    listReminders({ filter: "sent", search: "", page: 1 }),
  ]);
  const latest = sent.rows.slice(0, SHOWN_MESSAGES);
  const number = (value?: string) => Number(value) || 0;

  const moves = [
    { days: "1", label: c.moveDay },
    { days: "7", label: c.moveWeek },
    { days: "next-due", label: c.moveDue },
  ];

  const steps = story && [
    { text: c.story.overdue, href: story.ledger, link: c.story.openLedger },
    story.paid
      ? { text: c.story.alreadyPaid }
      : { text: c.story.pay, href: story.payLink, link: c.story.openPay, external: true },
    { text: c.story.move },
    { text: c.story.check, href: "/staff/reminders?status=stopped", link: c.story.openReminders },
  ];

  return (
    <>
      <div className="max-w-[640px]">
        <h1 className="text-[32px] leading-10 font-medium">{c.title}</h1>
        <p className="mt-2 text-muted">{c.intro}</p>
        <a
          href="/guide/index.html"
          className="inline-block min-h-12 py-3 font-medium underline underline-offset-4"
        >
          {c.guide}
        </a>
      </div>

      <section className="flex flex-col gap-4 rounded-md border border-divider bg-surface p-6">
        <div>
          <p className="text-sm text-muted">{c.dateLabel}</p>
          <p className="mt-1 text-2xl leading-8 font-medium">{formatDate(date, locale)}</p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {moves.map((move) => (
            <form key={move.days} action={moveTime}>
              <input type="hidden" name="days" value={move.days} />
              <SubmitButton label={move.label} pendingLabel={c.moving} variant="secondary" />
            </form>
          ))}
        </div>
        {query.moved && (
          <p role="status" className="rounded-md bg-paid-tint px-4 py-3 text-paid">
            {c.moved(
              number(query.moved),
              number(query.sent),
              number(query.stopped),
              number(query.paid),
              number(query.tasks),
            )}
          </p>
        )}
      </section>

      {steps && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl leading-7 font-medium">{c.story.title}</h2>
          <ol className="flex list-decimal flex-col gap-2 pl-5">
            {steps.map((step) => (
              <li key={step.text}>
                {step.text}{" "}
                {step.href &&
                  (step.external ? (
                    <a href={step.href} target="_blank" rel="noreferrer" className={rowLink}>
                      {step.link}
                    </a>
                  ) : (
                    <Link href={step.href} className={rowLink}>
                      {step.link}
                    </Link>
                  ))}
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-xl leading-7 font-medium">{c.phoneTitle}</h2>
        <p className="text-muted">{c.phoneHint}</p>
        {latest.length === 0 ? (
          <p className="rounded-md border border-divider bg-surface p-6 text-muted">
            {c.phoneEmpty}
          </p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-3">
            {latest.map((item) => (
              <li key={item.id} className="rounded-md border border-divider bg-surface p-4">
                <p className="text-sm text-muted">
                  {item.studentName} · {formatDate(item.sendOn, locale)}
                </p>
                <p className="mt-2 rounded-md bg-highlight p-3 text-sm break-words">
                  {item.message}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl leading-7 font-medium">{c.runsTitle}</h2>
        <p className="text-muted">{c.runsHint}</p>
        <PipelineRuns runs={runs} locale={locale} t={t} />
      </section>

      <section className="flex flex-col gap-3 pb-8">
        <h2 className="text-xl leading-7 font-medium">{c.loginsTitle}</h2>
        <DataTable
          rows={c.logins}
          rowKey={(row) => row.phone}
          columns={[
            { header: c.phone, cell: (row) => row.phone },
            { header: c.who, cell: (row) => row.who },
          ]}
        />
        <details className="mt-3">
          <summary className={`${buttonStyles.link} inline-block cursor-pointer py-3 text-error`}>
            {c.reset}
          </summary>
          <form action={resetEverything} className="mt-3 flex max-w-[480px] flex-col gap-3">
            <p>{c.resetWarning}</p>
            <SubmitButton label={c.resetConfirm} pendingLabel={c.resetting} variant="secondary" />
          </form>
        </details>
      </section>
    </>
  );
}
