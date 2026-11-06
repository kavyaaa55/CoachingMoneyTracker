import { DataTable } from "@/components/data-table";
import { PipelineRuns } from "@/components/pipeline-runs";
import { formatInr } from "@/domain/money";
import { summariseRefunds } from "@/domain/refund";
import {
  BRIEF_CLOSE_DAYS,
  BRIEF_LATE_PERCENT,
  lateShare,
  lateShareByCentre,
  lateShareByMonth,
} from "@/domain/scoreboard";
import { formatDate, messages } from "@/i18n";
import { requireUser } from "@/lib/auth";
import { latestClose } from "@/lib/books";
import { today } from "@/lib/clock";
import { getLocale } from "@/lib/locale";
import { recentRuns } from "@/lib/pipeline";
import { listRefunds } from "@/lib/refunds";
import { matchingHealth, reminderResponse, scoredInstalments } from "@/lib/scoreboard";

export default async function ScoreboardPage() {
  await requireUser("accounts");
  const locale = await getLocale();
  const t = messages(locale);
  const s = t.staff.scoreboard;
  const date = today();

  const [instalments, response, matching, refundRows, runs, close] = await Promise.all([
    scoredInstalments(),
    reminderResponse(),
    matchingHealth(date),
    listRefunds(),
    recentRuns(),
    latestClose(),
  ]);

  const late = lateShare(instalments, date);
  const months = lateShareByMonth(instalments, date);
  const byCentre = lateShareByCentre(instalments, date);
  const refunds = summariseRefunds(refundRows, date);
  const autoPercent =
    matching.matched === 0 ? 0 : Math.round((matching.automatic / matching.matched) * 100);

  const monthName = (month: string) =>
    formatDate(`${month}-01`, locale).split(" ").slice(1).join(" ");

  const measures = [
    {
      name: s.lateName,
      from: `${BRIEF_LATE_PERCENT.baseline}%`,
      to: `${BRIEF_LATE_PERCENT.target}%`,
      now: late.percent === null ? s.notYet : `${late.percent}%`,
      detail:
        late.percent === null ? s.lateEmpty : s.lateDetail(formatInr(late.late), formatInr(late.measured)),
    },
    {
      name: s.closeName,
      from: s.days(BRIEF_CLOSE_DAYS.baseline),
      to: s.days(BRIEF_CLOSE_DAYS.target),
      now: close ? s.days(close.days) : s.notYet,
      detail: `${close ? s.closeDetail(monthName(close.month)) : s.closeEmpty} ${s.autoDetail(autoPercent)} ${
        matching.oldestDays === null
          ? s.queueClear
          : s.queueDetail(matching.queued, matching.oldestDays)
      }`,
    },
    {
      name: s.callsName,
      from: s.callsFrom,
      to: s.callsTo,
      now: s.notTracked,
      detail: s.callsDetail,
    },
  ];

  const support = [
    { label: s.followed, value: s.followedValue(response.followed, response.sent), hint: s.followedHint },
    { label: s.refundsInTime, value: t.staff.refunds.inTimeValue(refunds.paidInTime, refunds.paid) },
  ];

  const shareColumns = (header: string, label: (key: string) => string) => [
    { header, cell: (row: (typeof months)[number]) => label(row.key) },
    { header: s.measured, align: "right" as const, cell: (row: (typeof months)[number]) => formatInr(row.measured) },
    { header: s.lateAmount, align: "right" as const, cell: (row: (typeof months)[number]) => formatInr(row.late) },
    { header: s.share, align: "right" as const, cell: (row: (typeof months)[number]) => `${row.percent}%` },
  ];

  return (
    <>
      <div className="max-w-[640px]">
        <h1 className="text-[32px] leading-10 font-medium">{s.title}</h1>
        <p className="mt-2 text-muted">{s.intro}</p>
        <p className="mt-2 text-sm text-muted">{s.sample(formatDate(date, locale))}</p>
      </div>

      <DataTable
        rows={measures}
        rowKey={(row) => row.name}
        columns={[
          { header: s.measure, cell: (row) => row.name },
          { header: s.baseline, align: "right", cell: (row) => row.from },
          { header: s.target, align: "right", cell: (row) => row.to },
          { header: s.now, align: "right", cell: (row) => <span className="font-medium">{row.now}</span> },
          { header: s.detail, cell: (row) => <span className="text-muted">{row.detail}</span> },
        ]}
      />

      <dl className="grid gap-x-6 gap-y-4 rounded-md border border-divider bg-surface p-6 md:grid-cols-2">
        {support.map((item) => (
          <div key={item.label}>
            <dt className="text-sm text-muted">{item.label}</dt>
            <dd className="mt-1 text-2xl leading-8 font-medium">{item.value}</dd>
            {item.hint && <dd className="text-sm text-muted">{item.hint}</dd>}
          </div>
        ))}
      </dl>

      {months.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="flex min-w-0 flex-col gap-3">
            <h2 className="text-xl leading-7 font-medium">{s.byMonth}</h2>
            <DataTable
              rows={months}
              rowKey={(row) => row.key}
              columns={shareColumns(s.dueMonth, monthName)}
            />
          </section>
          <section className="flex min-w-0 flex-col gap-3">
            <h2 className="text-xl leading-7 font-medium">{s.byCentre}</h2>
            <DataTable
              rows={byCentre}
              rowKey={(row) => row.key}
              columns={shareColumns(s.centre, (key) => key)}
            />
          </section>
        </div>
      )}

      <section className="flex flex-col gap-3 pb-8">
        <h2 className="text-xl leading-7 font-medium">{s.pipelineTitle}</h2>
        <p className="text-muted">{s.pipelineHint}</p>
        <PipelineRuns runs={runs} locale={locale} t={t} />
      </section>
    </>
  );
}
