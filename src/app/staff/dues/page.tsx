import Link from "next/link";
import { buttonStyles, rowLink } from "@/components/button-styles";
import { DataTable } from "@/components/data-table";
import { TextField } from "@/components/text-field";
import { AGEING_BUCKETS, duesByBatch, summariseDues } from "@/domain/dues";
import type { UnmatchedReason } from "@/domain/payments";
import { formatInr } from "@/domain/money";
import { defaultExportFrom } from "@/domain/tally";
import { formatDate, messages } from "@/i18n";
import { requireUser } from "@/lib/auth";
import { istDate, today } from "@/lib/clock";
import {
  allBatchNames,
  countStudentsLeft,
  duesInstalments,
  QUEUE_LIMIT,
  unmatchedQueue,
} from "@/lib/dues";
import { getLocale } from "@/lib/locale";
import { allCentres } from "@/lib/staff-students";

type Query = {
  centre?: string | string[];
  batch?: string | string[];
  error?: string | string[];
  from?: string | string[];
  to?: string | string[];
};

const text = (value?: string | string[]) => (typeof value === "string" ? value : "");

/** Keeps a bad date in the address out of the date field. */
const dateOr = (value: string | string[] | undefined, fallback: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(text(value)) ? text(value) : fallback;

export default async function DuesPage({ searchParams }: { searchParams: Promise<Query> }) {
  await requireUser("accounts");
  const query = await searchParams;
  const locale = await getLocale();
  const t = messages(locale);
  const d = t.staff.dues;
  const date = today();

  const [centres, batchNames] = await Promise.all([allCentres(), allBatchNames()]);

  // Only real choices count as filters, so the page and its dropdowns always agree.
  const centreId = centres.find((centre) => centre.id === text(query.centre))?.id ?? null;
  const batch = batchNames.find((name) => name === text(query.batch)) ?? null;
  const filters = { centreId, batch };
  const filtering = Boolean(centreId || batch);

  const [instalments, studentsLeft, queue] = await Promise.all([
    duesInstalments(filters),
    countStudentsLeft(filters),
    unmatchedQueue(),
  ]);
  const summary = summariseDues(instalments, date);
  const rows = duesByBatch(instalments, date);

  const figures = [
    { label: d.billed, value: summary.billed },
    { label: d.collected, value: summary.collected },
    { label: d.outstanding, value: summary.outstanding, hint: d.outstandingHint },
    { label: d.overdue, value: summary.overdue, hint: d.overdueHint },
  ];

  const selectClass = "h-12 w-full rounded-md border border-control bg-surface px-3";
  const exportError = { dates: d.badDates, empty: d.noReceipts }[text(query.error)];

  return (
    <>
      <div>
        <h1 className="text-[32px] leading-10 font-medium">{d.title}</h1>
        <p className="mt-1 text-muted">{d.students(summary.students)}</p>
        {studentsLeft > 0 && <p className="text-muted">{d.leftOut(studentsLeft)}</p>}
      </div>

      <form className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="flex flex-1 flex-col gap-2">
          <label htmlFor="centre" className="font-medium">
            {d.centreLabel}
          </label>
          <select id="centre" name="centre" defaultValue={centreId ?? ""} className={selectClass}>
            <option value="">{d.allCentres}</option>
            {centres.map((centre) => (
              <option key={centre.id} value={centre.id}>
                {centre.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <label htmlFor="batch" className="font-medium">
            {d.batchLabel}
          </label>
          <select id="batch" name="batch" defaultValue={batch ?? ""} className={selectClass}>
            <option value="">{d.allBatches}</option>
            {batchNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div className="lg:w-32">
          <button type="submit" className={buttonStyles.secondary}>
            {d.apply}
          </button>
        </div>
        {filtering && (
          <Link
            href="/staff/dues"
            className="min-h-12 self-center px-2 py-3 font-medium underline underline-offset-4"
          >
            {d.clear}
          </Link>
        )}
      </form>

      {rows.length === 0 ? (
        <p className="rounded-md border border-divider bg-surface p-6 text-muted">
          {filtering ? d.noResults : d.none}
        </p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-md border border-divider bg-surface p-6 lg:grid-cols-4">
            {figures.map((item) => (
              <div key={item.label}>
                <dt className="text-sm text-muted">{item.label}</dt>
                <dd className="mt-1 text-2xl leading-8 font-medium">{formatInr(item.value)}</dd>
                {item.hint && <dd className="text-sm text-muted">{item.hint}</dd>}
              </div>
            ))}
          </dl>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl leading-7 font-medium">{d.ageingTitle}</h2>
            <dl className="grid divide-y divide-divider rounded-md border border-divider bg-surface lg:grid-cols-3 lg:divide-x lg:divide-y-0">
              {AGEING_BUCKETS.map((bucket) => {
                const { amount, students } = summary.ageing[bucket];
                const flagged = bucket === "over60" && amount > 0;
                return (
                  <div key={bucket} className="p-6">
                    <dt className="text-sm text-muted">{d.ageing[bucket]}</dt>
                    <dd className={`mt-1 text-2xl leading-8 font-medium ${flagged ? "text-overdue" : ""}`}>
                      {formatInr(amount)}
                    </dd>
                    <dd className="text-sm text-muted">{d.students(students)}</dd>
                  </div>
                );
              })}
            </dl>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl leading-7 font-medium">{d.byBatch}</h2>
            <DataTable
              rows={rows}
              rowKey={(row) => row.batchId}
              columns={[
                { header: d.centre, cell: (row) => row.centre },
                { header: d.batch, cell: (row) => row.batch },
                { header: d.studentCount, align: "right", cell: (row) => row.students },
                { header: d.billed, align: "right", cell: (row) => formatInr(row.billed) },
                { header: d.collected, align: "right", cell: (row) => formatInr(row.collected) },
                { header: d.outstanding, align: "right", cell: (row) => formatInr(row.outstanding) },
                { header: d.overdue, align: "right", cell: (row) => formatInr(row.overdue) },
                {
                  header: d.over60,
                  align: "right",
                  cell: (row) => (
                    <span className={row.ageing.over60.amount > 0 ? "text-overdue" : ""}>
                      {formatInr(row.ageing.over60.amount)}
                    </span>
                  ),
                },
              ]}
            />
          </section>
        </>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-xl leading-7 font-medium">
          {d.queueTitle} ({queue.total})
        </h2>
        <p className="text-muted">{d.queueIntro}</p>
        <Link href="/staff/books" className="min-h-12 self-start py-3 font-medium underline underline-offset-4">
          {d.queueResolve}
        </Link>
        {queue.rows.length === 0 ? (
          <p className="rounded-md border border-divider bg-surface p-6 text-muted">
            {d.queueEmpty}
          </p>
        ) : (
          <DataTable
            rows={queue.rows}
            rowKey={(row) => row.id}
            columns={[
              {
                header: d.queueDate,
                cell: (row) => formatDate(istDate(row.paidAt), locale),
              },
              { header: d.queueAmount, align: "right", cell: (row) => formatInr(row.amount) },
              {
                header: d.queueReference,
                cell: (row) => <span className="break-all">{row.reference}</span>,
              },
              {
                header: d.queueReason,
                cell: (row) => row.reason && d.queueReasons[row.reason as UnmatchedReason],
              },
              {
                header: d.queueStudent,
                cell: (row) =>
                  row.studentId ? (
                    <Link href={`/staff/students/${row.studentId}`} className={rowLink}>
                      {row.studentCode}
                    </Link>
                  ) : (
                    d.queueNoStudent
                  ),
              },
            ]}
          />
        )}
        {queue.total > QUEUE_LIMIT && (
          <p className="text-sm text-muted">{d.queueMore(QUEUE_LIMIT, queue.total)}</p>
        )}
      </section>

      <section className="flex flex-col gap-3 pb-8">
        <h2 className="text-xl leading-7 font-medium">{d.exportTitle}</h2>
        <p className="text-muted">{d.exportHint}</p>
        <form action="/staff/dues/tally" className="flex flex-col gap-3 lg:flex-row lg:items-end">
          {centreId && <input type="hidden" name="centre" value={centreId} />}
          {batch && <input type="hidden" name="batch" value={batch} />}
          <div className="flex-1">
            <TextField
              name="from"
              label={d.from}
              type="date"
              defaultValue={dateOr(query.from, defaultExportFrom(date))}
            />
          </div>
          <div className="flex-1">
            <TextField name="to" label={d.to} type="date" defaultValue={dateOr(query.to, date)} />
          </div>
          <div className="lg:w-64">
            <button type="submit" className={buttonStyles.secondary}>
              {d.download}
            </button>
          </div>
        </form>
        {exportError && (
          <p role="alert" className="rounded-md bg-error-tint px-4 py-3 text-error">
            {exportError}
          </p>
        )}
      </section>
    </>
  );
}
