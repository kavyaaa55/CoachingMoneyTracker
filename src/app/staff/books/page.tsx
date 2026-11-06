import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { buttonStyles, rowLink } from "@/components/button-styles";
import { monthsBetween, lastDayOf } from "@/domain/books";
import { formatInr } from "@/domain/money";
import { formatDate, messages } from "@/i18n";
import { requireUser } from "@/lib/auth";
import { monthReport, queueWithSuggestions } from "@/lib/books";
import { today } from "@/lib/clock";
import { getLocale } from "@/lib/locale";
import { applyFromQueue, closeThisMonth } from "./actions";

type Query = { month?: string; applied?: string };

const TERM_START = "2026-07-01";

export default async function BooksPage({ searchParams }: { searchParams: Promise<Query> }) {
  await requireUser("accounts");
  const query = await searchParams;
  const locale = await getLocale();
  const t = messages(locale);
  const b = t.staff.books;
  const date = today();

  const months = monthsBetween(TERM_START, date);
  const lastEnded = months.find((month) => lastDayOf(month) < date) ?? months[0];
  const month = months.find((item) => item === query.month) ?? lastEnded;
  const monthLabel = (value: string) =>
    formatDate(`${value}-01`, locale).split(" ").slice(1).join(" ");

  const [report, queue] = await Promise.all([monthReport(month), queueWithSuggestions()]);
  const isOver = lastDayOf(month) < date;

  return (
    <>
      <div className="max-w-[640px]">
        <h1 className="text-[32px] leading-10 font-medium">{b.title}</h1>
        <p className="mt-2 text-muted">{b.intro}</p>
      </div>

      {query.applied && (
        <p role="status" className="rounded-md bg-paid-tint px-4 py-3 text-paid">
          {b.applied}
        </p>
      )}

      <section className="flex flex-col gap-4 rounded-md border border-divider bg-surface p-6">
        <form className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="flex flex-1 flex-col gap-2">
            <label htmlFor="month" className="font-medium">
              {b.month}
            </label>
            <select
              id="month"
              name="month"
              defaultValue={month}
              className="h-12 w-full rounded-md border border-control bg-surface px-3"
            >
              {months.map((item) => (
                <option key={item} value={item}>
                  {monthLabel(item)}
                </option>
              ))}
            </select>
          </div>
          <div className="md:w-40">
            <button type="submit" className={buttonStyles.secondary}>
              {b.show}
            </button>
          </div>
        </form>

        <ul className="divide-y divide-divider">
          {report.checks.map(({ check, passed, left, right }) => (
            <li key={check} className="flex flex-col gap-1 py-3 md:flex-row md:justify-between md:gap-4">
              <div>
                <p>{b.checks[check].name}</p>
                <p className="text-sm text-muted">
                  {check === "queue" || check === "receipts"
                    ? b.checks[check].detail(left)
                    : b.amounts(formatInr(left), formatInr(right))}
                </p>
              </div>
              <span
                className={`self-start rounded-sm px-2 py-0.5 text-[13px] font-medium ${
                  passed ? "bg-paid-tint text-paid" : "bg-overdue-tint text-overdue"
                }`}
              >
                {passed ? b.agrees : b.needsWork}
              </span>
            </li>
          ))}
        </ul>

        {report.close ? (
          <p className="rounded-md bg-paid-tint px-4 py-3 text-paid">
            {b.closed(monthLabel(month), formatDate(report.close.closedOn, locale))}
          </p>
        ) : !isOver ? (
          <p className="rounded-md bg-highlight px-4 py-3">{b.notOver}</p>
        ) : report.passed ? (
          <ActionForm action={closeThisMonth} label={b.close(monthLabel(month))} pendingLabel={b.closing}>
            <input type="hidden" name="month" value={month} />
          </ActionForm>
        ) : (
          <p className="rounded-md bg-highlight px-4 py-3">{b.cannotClose}</p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl leading-7 font-medium">
          {b.queueTitle} ({queue.total})
        </h2>
        <p className="text-muted">{b.queueIntro}</p>
        {queue.rows.length === 0 ? (
          <p className="rounded-md border border-divider bg-surface p-6 text-muted">{b.queueEmpty}</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {queue.rows.map((row) => (
              <li key={row.id} className="flex flex-col gap-3 rounded-md border border-divider bg-surface p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-lg font-medium">{formatInr(row.amount)}</p>
                  <p className="text-sm break-all text-muted">{row.reference}</p>
                </div>
                {row.reason && (
                  <p className="text-muted">
                    {t.staff.dues.queueReasons[row.reason as keyof typeof t.staff.dues.queueReasons]}
                  </p>
                )}
                {row.suggestions.length === 0 ? (
                  <p>{b.noSuggestion}</p>
                ) : (
                  row.suggestions.map((item) => (
                    <div key={item.instalmentId} className="flex flex-col gap-2 border-t border-divider pt-3">
                      <p>
                        <Link href={`/staff/students/${item.studentId}`} className={rowLink}>
                          {item.studentName}
                        </Link>{" "}
                        · {t.receipt.instalment(item.sequence)} · {b.balance(formatInr(item.balance))}
                      </p>
                      <p className="text-sm text-muted">{b.reasons[item.reason]}</p>
                      <div className="md:w-72">
                        <ActionForm
                          action={applyFromQueue}
                          label={b.apply}
                          pendingLabel={b.applying}
                          variant="secondary"
                        >
                          <input type="hidden" name="paymentId" value={row.id} />
                          <input type="hidden" name="instalmentId" value={item.instalmentId} />
                        </ActionForm>
                      </div>
                    </div>
                  ))
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-wrap gap-x-6 pb-8">
        <Link href="/staff/audit" className="min-h-12 py-3 font-medium underline underline-offset-4">
          {b.openAudit}
        </Link>
        <Link href="/staff/dues" className="min-h-12 py-3 font-medium underline underline-offset-4">
          {b.openExport}
        </Link>
      </div>
    </>
  );
}
