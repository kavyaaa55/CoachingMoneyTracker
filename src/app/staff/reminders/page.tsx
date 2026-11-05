import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonStyles, rowLink } from "@/components/button-styles";
import { DataTable } from "@/components/data-table";
import { SubmitButton } from "@/components/submit-button";
import type { StopReason } from "@/domain/reminders";
import { formatDate, messages, stageLabel } from "@/i18n";
import { requireUser } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import {
  listReminders,
  REMINDER_FILTERS,
  REMINDERS_PER_PAGE,
  type ReminderFilter,
} from "@/lib/reminders";
import { runRemindersNow } from "./actions";

type Query = {
  status?: string;
  q?: string;
  page?: string;
  sent?: string;
  stopped?: string;
  failed?: string;
};

const chipStyles = {
  queued: "bg-highlight text-ink",
  sent: "bg-paid-tint text-paid",
  stopped: "bg-surface text-muted border border-divider",
};

const isFilter = (value?: string): value is ReminderFilter =>
  REMINDER_FILTERS.includes(value as ReminderFilter);

export default async function RemindersPage({ searchParams }: { searchParams: Promise<Query> }) {
  await requireUser("accounts");
  const query = await searchParams;
  const locale = await getLocale();
  const t = messages(locale);
  const r = t.reminders;

  const filter = isFilter(query.status) ? query.status : "all";
  const search = (query.q ?? "").trim().slice(0, 60);
  const page = Math.max(1, Math.floor(Number(query.page)) || 1);

  const { rows, counts } = await listReminders({ filter, search, page });
  const pages = Math.max(1, Math.ceil(counts[filter] / REMINDERS_PER_PAGE));

  const href = (changes: { status?: string; page?: number }) => {
    const params = new URLSearchParams({ status: changes.status ?? filter });
    if (search) params.set("q", search);
    if (changes.page) params.set("page", String(changes.page));
    return `/staff/reminders?${params}`;
  };
  if (rows.length === 0 && counts[filter] > 0) redirect(href({ page: pages }));

  const ran = query.sent !== undefined;
  const sent = Number(query.sent) || 0;
  const stopped = Number(query.stopped) || 0;
  const failed = Number(query.failed) || 0;

  return (
    <>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="max-w-[640px]">
          <h1 className="text-[32px] leading-10 font-medium">{r.title}</h1>
          <p className="mt-2 text-muted">{r.intro}</p>
          <p className="mt-1 text-sm text-muted">{r.mocked}</p>
        </div>
        <form action={runRemindersNow} className="md:w-64">
          <SubmitButton label={r.run} pendingLabel={r.running} />
        </form>
      </div>

      {ran && (
        <p role="status" className="rounded-md bg-paid-tint px-4 py-3 text-paid">
          {sent + stopped + failed === 0 ? r.nothingDue : r.result(sent, stopped)}{" "}
          {failed > 0 && r.failed(failed)}
        </p>
      )}

      <nav className="flex flex-wrap gap-x-4">
        {REMINDER_FILTERS.map((item) => (
          <Link
            key={item}
            href={href({ status: item })}
            aria-current={item === filter ? "page" : undefined}
            className={
              item === filter
                ? "min-h-12 py-3 font-medium underline underline-offset-4"
                : "min-h-12 py-3 text-muted"
            }
          >
            {r[item]} ({counts[item]})
          </Link>
        ))}
      </nav>

      <form className="flex gap-3 md:max-w-[480px]">
        <input type="hidden" name="status" value={filter} />
        <label htmlFor="q" className="sr-only">
          {r.searchLabel}
        </label>
        <input
          id="q"
          name="q"
          defaultValue={search}
          placeholder={r.searchHint}
          maxLength={60}
          className="h-12 min-w-0 flex-1 rounded-md border border-control bg-surface px-4"
        />
        <div className="w-28">
          <button type="submit" className={buttonStyles.secondary}>
            {r.search}
          </button>
        </div>
      </form>

      {rows.length === 0 ? (
        <p className="rounded-md border border-divider bg-surface p-6 text-muted">
          {search ? r.noResults : r.empty}
        </p>
      ) : (
        <DataTable
          rows={rows}
          rowKey={(row) => row.id}
          columns={[
            {
              header: r.student,
              cell: (row) => (
                <Link href={`/staff/students/${row.studentId}`} className={rowLink}>
                  {row.studentName}
                </Link>
              ),
            },
            { header: r.instalment, cell: (row) => row.sequence },
            { header: r.stage, cell: (row) => stageLabel(row.dayOffset, t) },
            {
              header: r.sendOn,
              cell: (row) => <span className="whitespace-nowrap">{formatDate(row.sendOn, locale)}</span>,
            },
            { header: r.language, cell: (row) => r.languages[row.language] },
            {
              header: r.status,
              cell: (row) => (
                <span
                  className={`inline-block rounded-sm px-2 py-0.5 text-[13px] font-medium ${chipStyles[row.status]}`}
                >
                  {r[row.status]}
                  {row.stoppedReason && `: ${r.reasons[row.stoppedReason as StopReason]}`}
                </span>
              ),
            },
            {
              header: r.message,
              cell: (row) =>
                row.message ? (
                  <details className="max-w-[260px] text-left">
                    <summary className="cursor-pointer font-medium underline underline-offset-4">
                      {r.viewMessage}
                    </summary>
                    <p className="mt-2 text-sm break-all text-muted">{row.message}</p>
                  </details>
                ) : (
                  <span className="text-muted">-</span>
                ),
            },
          ]}
        />
      )}

      {pages > 1 && (
        <nav className="flex items-center justify-between pb-8">
          {page > 1 ? (
            <Link href={href({ page: page - 1 })} className="min-h-12 py-3 font-medium underline underline-offset-4">
              {t.staff.students.previous}
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted">{t.staff.students.page(page, pages)}</span>
          {page < pages ? (
            <Link href={href({ page: page + 1 })} className="min-h-12 py-3 font-medium underline underline-offset-4">
              {t.staff.students.next}
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  );
}
