import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonStyles, rowLink } from "@/components/button-styles";
import { DataTable } from "@/components/data-table";
import { ReverseForm } from "@/components/reverse-form";
import { RiskChip } from "@/components/risk-chip";
import { StatusChip } from "@/components/status-chip";
import { balanceOf, instalmentStatus, summariseLedger } from "@/domain/instalments";
import { formatInr } from "@/domain/money";
import { formatDate, messages, riskReasonLabel } from "@/i18n";
import { requireUser } from "@/lib/auth";
import { today } from "@/lib/clock";
import { istDate } from "@/lib/clock";
import { instalmentsOf, paymentHistoryOf } from "@/lib/ledger";
import { getLocale } from "@/lib/locale";
import { riskOf } from "@/lib/risk";
import { studentById } from "@/lib/staff-students";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ recorded?: string }>;
};

export default async function StudentLedgerPage({ params, searchParams }: Props) {
  await requireUser("accounts");
  const { id } = await params;
  const { recorded } = await searchParams;

  const student = await studentById(id);
  if (!student) notFound();

  const locale = await getLocale();
  const t = messages(locale);
  const l = t.staff.ledger;
  const date = today();

  const [instalments, history, risk] = await Promise.all([
    instalmentsOf(id),
    paymentHistoryOf(id),
    riskOf(id, date),
  ]);
  const summary = summariseLedger(instalments, date);

  const figures = [
    { label: l.plan, value: formatInr(student.planTotal) },
    { label: l.discount, value: formatInr(student.discount) },
    { label: l.netFee, value: formatInr(student.planTotal - student.discount) },
    { label: l.paid, value: formatInr(summary.paid) },
    { label: l.balance, value: formatInr(summary.balance) },
  ];

  return (
    <>
      <div>
        <Link
          href="/staff/students"
          className="inline-block min-h-12 py-3 font-medium underline underline-offset-4"
        >
          {l.back}
        </Link>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-[32px] leading-10 font-medium">{student.name}</h1>
            <p className="mt-1 text-muted">
              {student.code} · {student.batch} · {student.centre}
            </p>
            <p className="text-muted">
              {student.parentName} · {student.parentPhone}
            </p>
          </div>
          <div className="flex flex-col gap-2 md:w-56">
            {summary.balance > 0 && !student.exitDate && (
              <Link href={`/staff/students/${id}/payment`} className={buttonStyles.primary}>
                {l.recordPayment}
              </Link>
            )}
            <Link href={`/staff/students/${id}/refund`} className={buttonStyles.secondary}>
              {student.exitDate ? l.viewRefund : l.workOutRefund}
            </Link>
          </div>
        </div>
      </div>

      {student.exitDate && (
        <p role="status" className="rounded-md bg-highlight px-4 py-3">
          {l.left(formatDate(student.exitDate, locale))}
        </p>
      )}

      {recorded && (
        <p role="status" className="rounded-md bg-paid-tint px-4 py-3 text-paid">
          {l.recorded}{" "}
          <Link href={`/staff/receipts/${recorded}`} className="font-medium underline underline-offset-4">
            {l.viewReceipt}
          </Link>
        </p>
      )}

      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-md border border-divider bg-surface p-6 md:grid-cols-6">
        {figures.map((item) => (
          <div key={item.label}>
            <dt className="text-sm text-muted">{item.label}</dt>
            <dd className="mt-1 text-lg font-medium">{item.value}</dd>
          </div>
        ))}
        <div>
          <dt className="text-sm text-muted">{l.overdue}</dt>
          <dd className={`mt-1 text-lg font-medium ${summary.overdue > 0 ? "text-overdue" : ""}`}>
            {formatInr(summary.overdue)}
          </dd>
          <dd className="text-sm text-muted">
            {summary.daysOverdue > 0 ? l.daysOverdue(summary.daysOverdue) : l.nothingOverdue}
          </dd>
        </div>
      </dl>

      {!student.exitDate && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl leading-7 font-medium">{l.riskTitle}</h2>
          <div className="rounded-md border border-divider bg-surface p-6">
            {risk.band === "none" && <p className="text-muted">{l.riskNone}</p>}
            {risk.band === "not-enough-data" && <p className="text-muted">{l.riskThin}</p>}
            {(risk.band === "watch" || risk.band === "high") && (
              <>
                <RiskChip band={risk.band} t={t} />
                <ul className="mt-3 list-disc pl-5">
                  {risk.reasons.map((reason) => (
                    <li key={reason.kind}>{riskReasonLabel(reason, t)}</li>
                  ))}
                </ul>
                <Link
                  href="/staff/tasks"
                  className="mt-2 inline-block py-3 font-medium underline underline-offset-4"
                >
                  {l.riskTasks}
                </Link>
              </>
            )}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-xl leading-7 font-medium">{l.instalments}</h2>
        {instalments.length === 0 ? (
          <p className="rounded-md border border-divider bg-surface p-6 text-muted">
            {l.noInstalments}
          </p>
        ) : (
          <DataTable
            rows={instalments}
            rowKey={(row) => row.id}
            columns={[
              { header: l.number, cell: (row) => row.sequence },
              { header: l.dueDate, cell: (row) => formatDate(row.dueDate, locale) },
              { header: l.amount, align: "right", cell: (row) => formatInr(row.amount) },
              { header: l.paid, align: "right", cell: (row) => formatInr(row.paid) },
              { header: l.balance, align: "right", cell: (row) => formatInr(balanceOf(row)) },
              {
                header: l.status,
                cell: (row) => <StatusChip status={instalmentStatus(row, date)} t={t} />,
              },
            ]}
          />
        )}
      </section>

      <section className="flex flex-col gap-3 pb-8">
        <h2 className="text-xl leading-7 font-medium">{l.payments}</h2>
        {history.length === 0 ? (
          <p className="rounded-md border border-divider bg-surface p-6 text-muted">
            {l.noPayments}
          </p>
        ) : (
          <DataTable
            rows={history}
            rowKey={(row) => row.id}
            columns={[
              {
                header: l.date,
                cell: (row) => formatDate(istDate(row.paidAt), locale),
              },
              { header: t.receipt.paidFor, cell: (row) => t.receipt.instalment(row.sequence) },
              { header: l.method, cell: (row) => t.paymentMethods[row.method] },
              {
                header: l.reference,
                cell: (row) => <span className="break-all">{row.reference}</span>,
              },
              { header: l.amount, align: "right", cell: (row) => formatInr(row.amount) },
              {
                header: l.receipt,
                cell: (row) => (
                  <Link href={`/staff/receipts/${row.id}`} className={`${rowLink} whitespace-nowrap`}>
                    {row.receiptNo}
                  </Link>
                ),
              },
              {
                header: l.reverse.column,
                cell: (row) =>
                  row.status === "reversed" ? (
                    <span className="text-overdue">
                      {l.reverse.done(formatDate(row.reversedOn!, locale), row.reversalNote ?? "")}
                    </span>
                  ) : student.exitDate ? (
                    "-"
                  ) : (
                    <ReverseForm paymentId={row.id} studentId={id} t={t} />
                  ),
              },
            ]}
          />
        )}
      </section>
    </>
  );
}
