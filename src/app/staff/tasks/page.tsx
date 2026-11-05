import Link from "next/link";
import { RiskChip } from "@/components/risk-chip";
import { SubmitButton } from "@/components/submit-button";
import { TaskReviewForm } from "@/components/task-review-form";
import { falseFlagRate } from "@/domain/risk";
import { formatDate, messages, riskReasonLabel } from "@/i18n";
import { requireUser } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { listTasks, TASK_FILTERS, TASKS_PER_PAGE, type TaskFilter } from "@/lib/risk";
import { reviewCallTask, runRiskCheckNow } from "./actions";

type Query = {
  status?: string;
  page?: string;
  saved?: string;
  checked?: string;
  flagged?: string;
  thin?: string;
};

const isFilter = (value?: string): value is TaskFilter =>
  TASK_FILTERS.includes(value as TaskFilter);

export default async function TasksPage({ searchParams }: { searchParams: Promise<Query> }) {
  await requireUser("accounts");
  const query = await searchParams;
  const locale = await getLocale();
  const t = messages(locale);
  const k = t.staff.tasks;

  const filter = isFilter(query.status) ? query.status : "open";
  const page = Math.max(1, Math.floor(Number(query.page)) || 1);

  const { rows, counts } = await listTasks(filter, page);
  const pages = Math.max(1, Math.ceil(counts[filter] / TASKS_PER_PAGE));
  const rate = falseFlagRate(counts.called, counts.false_flag);

  const ran = query.checked !== undefined;
  const thin = Number(query.thin) || 0;
  const saved = query.saved === "called" || query.saved === "false_flag" ? query.saved : null;

  const pageHref = (target: number) => `/staff/tasks?status=${filter}&page=${target}`;

  return (
    <>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="max-w-[640px]">
          <h1 className="text-[32px] leading-10 font-medium">{k.title}</h1>
          <p className="mt-2 text-muted">{k.intro}</p>
          <p className="mt-2">
            {rate === null
              ? k.noRate
              : k.rate(counts.false_flag, counts.called + counts.false_flag, rate)}
          </p>
        </div>
        <form action={runRiskCheckNow} className="md:w-64 md:shrink-0">
          <SubmitButton label={k.run} pendingLabel={k.running} />
        </form>
      </div>

      {ran && (
        <p role="status" className="rounded-md bg-paid-tint px-4 py-3 text-paid">
          {k.result(Number(query.checked) || 0, Number(query.flagged) || 0)}{" "}
          {thin > 0 && k.thin(thin)}
        </p>
      )}
      {saved && (
        <p role="status" className="rounded-md bg-paid-tint px-4 py-3 text-paid">
          {k.saved[saved]}
        </p>
      )}

      <nav className="flex flex-wrap gap-x-4">
        {TASK_FILTERS.map((item) => (
          <Link
            key={item}
            href={`/staff/tasks?status=${item}`}
            aria-current={item === filter ? "page" : undefined}
            className={
              item === filter
                ? "min-h-12 py-3 font-medium underline underline-offset-4"
                : "min-h-12 py-3 text-muted"
            }
          >
            {k.filters[item]} ({counts[item]})
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <p className="rounded-md border border-divider bg-surface p-6 text-muted">
          {k.empty[filter]}
        </p>
      ) : (
        <ul className="flex flex-col gap-4 pb-8">
          {rows.map((task) => (
            <li key={task.id} className="flex flex-col gap-3 rounded-md border border-divider bg-surface p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <Link
                    href={`/staff/students/${task.studentId}`}
                    className="text-lg font-medium underline underline-offset-4"
                  >
                    {task.studentName}
                  </Link>
                  <p className="text-sm text-muted">
                    {task.studentCode} · {task.batch} · {task.centre}
                  </p>
                </div>
                <RiskChip band={task.band} t={t} />
              </div>

              <ul className="list-disc pl-5">
                {task.reasons.map((reason) => (
                  <li key={reason.kind}>{riskReasonLabel(reason, t)}</li>
                ))}
              </ul>

              <p>
                {k.call(task.parentName)} ·{" "}
                <a href={`tel:${task.parentPhone}`} className="font-medium underline underline-offset-4">
                  {task.parentPhone}
                </a>
              </p>
              <p className="text-sm text-muted">
                {k.prefers(t.reminders.languages[task.parentLanguage])} ·{" "}
                {k.flaggedOn(formatDate(task.flaggedOn, locale))}
              </p>

              {task.status === "open" ? (
                <TaskReviewForm action={reviewCallTask} taskId={task.id} labels={k.form} />
              ) : (
                <div className="border-t border-divider pt-3">
                  {task.reviewedOn && (
                    <p className="text-sm text-muted">
                      {k.reviewedOn(formatDate(task.reviewedOn, locale))}
                    </p>
                  )}
                  {task.note && <p className="mt-1 break-words">{task.note}</p>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <nav className="flex items-center justify-between pb-8">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className="min-h-12 py-3 font-medium underline underline-offset-4">
              {k.previous}
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted">{k.page(page, pages)}</span>
          {page < pages ? (
            <Link href={pageHref(page + 1)} className="min-h-12 py-3 font-medium underline underline-offset-4">
              {k.next}
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  );
}
