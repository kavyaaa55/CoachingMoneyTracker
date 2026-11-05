import Link from "next/link";
import { buttonStyles } from "@/components/button-styles";
import { DataTable } from "@/components/data-table";
import { StatusChip } from "@/components/status-chip";
import {
  instalmentStatus,
  nextToPay,
  summariseLedger,
  type Instalment,
} from "@/domain/instalments";
import { formatInr } from "@/domain/money";
import { messages } from "@/i18n";
import { requireUser } from "@/lib/auth";
import { today } from "@/lib/clock";
import { instalmentsOfMany } from "@/lib/ledger";
import { getLocale } from "@/lib/locale";
import { allCentres, listStudents, STUDENTS_PER_PAGE } from "@/lib/staff-students";

type Query = { q?: string; centre?: string; page?: string };

export default async function StudentsPage({ searchParams }: { searchParams: Promise<Query> }) {
  await requireUser("accounts");
  const query = await searchParams;
  const t = messages(await getLocale());
  const s = t.staff.students;

  const search = (query.q ?? "").trim().slice(0, 60);
  const centreId = query.centre || null;
  const page = Math.max(1, Math.floor(Number(query.page)) || 1);

  const [{ rows, total }, centres] = await Promise.all([
    listStudents({ search, centreId, page }),
    allCentres(),
  ]);
  const instalments = rows.length ? await instalmentsOfMany(rows.map((row) => row.id)) : [];

  const date = today();
  const pages = Math.max(1, Math.ceil(total / STUDENTS_PER_PAGE));
  const filtering = Boolean(search || centreId);

  const byStudent = new Map<string, Instalment[]>();
  for (const item of instalments) {
    byStudent.set(item.studentId, [...(byStudent.get(item.studentId) ?? []), item]);
  }

  const tableRows = rows.map((row) => {
    const own = byStudent.get(row.id) ?? [];
    const next = nextToPay(own, date)?.next;
    return {
      ...row,
      summary: summariseLedger(own, date),
      status: next ? instalmentStatus(next, date) : null,
    };
  });

  const pageHref = (target: number) => {
    const params = new URLSearchParams({ page: String(target) });
    if (search) params.set("q", search);
    if (centreId) params.set("centre", centreId);
    return `/staff/students?${params}`;
  };

  return (
    <>
      <div>
        <h1 className="text-[32px] leading-10 font-medium">{s.title}</h1>
        <p className="mt-1 text-muted">{s.count(total)}</p>
      </div>

      <form className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="flex flex-1 flex-col gap-2">
          <label htmlFor="q" className="font-medium">
            {s.searchLabel}
          </label>
          <input
            id="q"
            name="q"
            defaultValue={search}
            placeholder={s.searchHint}
            maxLength={60}
            className="h-12 w-full rounded-md border border-control bg-surface px-4"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="centre" className="font-medium">
            {s.centreLabel}
          </label>
          <select
            id="centre"
            name="centre"
            defaultValue={centreId ?? ""}
            className="h-12 rounded-md border border-control bg-surface px-3"
          >
            <option value="">{s.allCentres}</option>
            {centres.map((centre) => (
              <option key={centre.id} value={centre.id}>
                {centre.name}
              </option>
            ))}
          </select>
        </div>
        <div className="md:w-32">
          <button type="submit" className={buttonStyles.secondary}>
            {s.search}
          </button>
        </div>
        {filtering && (
          <Link
            href="/staff/students"
            className="min-h-12 self-center px-2 py-3 font-medium underline underline-offset-4"
          >
            {s.clear}
          </Link>
        )}
      </form>

      {tableRows.length === 0 ? (
        <p className="rounded-md border border-divider bg-surface p-6 text-muted">
          {!filtering ? s.none : search ? s.noResults(search) : s.noResultsCentre}
        </p>
      ) : (
        <DataTable
          rows={tableRows}
          rowKey={(row) => row.id}
          columns={[
            {
              header: s.student,
              cell: (row) => (
                <Link
                  href={`/staff/students/${row.id}`}
                  className="font-medium underline underline-offset-4"
                >
                  {row.name}
                </Link>
              ),
            },
            { header: t.receipt.studentId, cell: (row) => row.code },
            { header: s.batch, cell: (row) => row.batch },
            { header: s.centre, cell: (row) => row.centre },
            { header: s.balance, align: "right", cell: (row) => formatInr(row.summary.balance) },
            {
              header: s.overdue,
              align: "right",
              cell: (row) => (
                <span className={row.summary.overdue > 0 ? "text-overdue" : ""}>
                  {formatInr(row.summary.overdue)}
                </span>
              ),
            },
            {
              header: s.status,
              cell: (row) => <StatusChip status={row.status ?? { kind: "paid" }} t={t} />,
            },
          ]}
        />
      )}

      {pages > 1 && (
        <nav className="flex items-center justify-between">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className="min-h-12 py-3 font-medium underline underline-offset-4">
              {s.previous}
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted">{s.page(page, pages)}</span>
          {page < pages ? (
            <Link href={pageHref(page + 1)} className="min-h-12 py-3 font-medium underline underline-offset-4">
              {s.next}
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  );
}
