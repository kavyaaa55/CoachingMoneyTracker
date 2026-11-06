import Link from "next/link";
import { rowLink } from "@/components/button-styles";
import { DataTable } from "@/components/data-table";
import { StatusChip } from "@/components/status-chip";
import { instalmentStatus } from "@/domain/instalments";
import { formatInr } from "@/domain/money";
import { refundStage, summariseRefunds } from "@/domain/refund";
import { formatDate, messages } from "@/i18n";
import { requireUser } from "@/lib/auth";
import { today } from "@/lib/clock";
import { getLocale } from "@/lib/locale";
import { listRefunds } from "@/lib/refunds";

export default async function RefundsPage() {
  await requireUser("accounts");
  const locale = await getLocale();
  const t = messages(locale);
  const r = t.staff.refunds;
  const date = today();

  const rows = await listRefunds();
  const summary = summariseRefunds(rows, date);

  // Open refunds come first, soonest deadline at the top. Finished ones follow.
  const isOpen = (row: (typeof rows)[number]) => row.refund > 0 && row.status !== "paid";
  const ordered = [...rows.filter(isOpen), ...rows.filter((row) => !isOpen(row))];

  const figures = [
    { label: r.toApprove, value: summary.toApprove },
    { label: r.toPay, value: summary.toPay },
    { label: r.overdue, value: summary.overdue, late: summary.overdue > 0 },
    { label: r.inTime, value: r.inTimeValue(summary.paidInTime, summary.paid) },
  ];

  return (
    <>
      <div className="max-w-[640px]">
        <h1 className="text-[32px] leading-10 font-medium">{r.title}</h1>
        <p className="mt-2 text-muted">{r.intro}</p>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-md border border-divider bg-surface p-6 text-muted">{r.none}</p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-md border border-divider bg-surface p-6 lg:grid-cols-4">
            {figures.map((item) => (
              <div key={item.label}>
                <dt className="text-sm text-muted">{item.label}</dt>
                <dd className={`mt-1 text-2xl leading-8 font-medium ${item.late ? "text-overdue" : ""}`}>
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>

          <div className="pb-8">
            <DataTable
              rows={ordered}
              rowKey={(row) => row.id}
              columns={[
                {
                  header: r.student,
                  cell: (row) => (
                    <Link
                      href={`/staff/students/${row.studentId}/refund`}
                      className={`${rowLink} whitespace-nowrap`}
                    >
                      {row.studentName}
                    </Link>
                  ),
                },
                { header: r.centre, cell: (row) => `${row.centre} · ${row.batch}` },
                { header: r.left, cell: (row) => formatDate(row.exitDate, locale) },
                { header: r.amount, align: "right", cell: (row) => formatInr(row.refund) },
                {
                  header: r.deadline,
                  cell: (row) =>
                    isOpen(row) ? (
                      <StatusChip
                        status={instalmentStatus(
                          { dueDate: row.dueBy, amount: row.refund, paid: 0 },
                          date,
                        )}
                        t={t}
                      />
                    ) : (
                      formatDate(row.dueBy, locale)
                    ),
                },
                { header: r.stage, cell: (row) => r.stages[refundStage(row.refund, row.status)] },
              ]}
            />
          </div>
        </>
      )}
    </>
  );
}
