import { GST_RATE_PERCENT, SAMPLE_GSTIN, splitGst } from "@/domain/gst";
import { formatInr } from "@/domain/money";
import { formatDate, type Locale } from "@/i18n";
import type { Messages } from "@/i18n/en";
import type { Receipt } from "@/lib/ledger";
import { PrintButton } from "./print-button";

type Props = { receipt: Receipt; locale: Locale; t: Messages };

export function ReceiptView({ receipt, locale, t }: Props) {
  const { taxable, cgst, sgst } = splitGst(receipt.amount);
  const halfRate = String(GST_RATE_PERCENT / 2);
  const paidOn = receipt.paidAt.toISOString().slice(0, 10);

  const details = [
    [t.receipt.number, receipt.receiptNo],
    [t.receipt.date, formatDate(paidOn, locale)],
    [t.receipt.student, receipt.studentName],
    [t.receipt.studentId, receipt.studentCode],
    [t.receipt.batch, receipt.batch],
    [t.receipt.paidFor, t.receipt.instalment(receipt.sequence)],
    [t.receipt.paidBy, t.paymentMethods[receipt.method]],
    [t.receipt.reference, receipt.reference],
  ];
  const amounts = [
    [t.receipt.taxable, formatInr(taxable)],
    [t.receipt.cgst(halfRate), formatInr(cgst)],
    [t.receipt.sgst(halfRate), formatInr(sgst)],
  ];

  return (
    <>
      <article className="rounded-md border border-divider bg-surface p-6">
        <header>
          <p className="text-sm text-muted">
            {t.institute}, Jaipur · {t.receipt.gstin} {SAMPLE_GSTIN}
          </p>
          <h1 className="mt-1 text-[32px] leading-10 font-medium">{t.receipt.title}</h1>
        </header>

        <dl className="mt-6">
          {details.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 py-1.5">
              <dt className="text-muted">{label}</dt>
              <dd className="text-right break-all">{value}</dd>
            </div>
          ))}
        </dl>

        <dl className="mt-4 border-t border-divider pt-4">
          {amounts.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 py-1.5">
              <dt className="text-muted">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
          <div className="mt-2 flex justify-between gap-4 border-t border-divider pt-3 text-lg font-medium">
            <dt>{t.receipt.total}</dt>
            <dd>{formatInr(receipt.amount)}</dd>
          </div>
        </dl>

        <p className="mt-6 text-sm text-muted">{t.receipt.sampleNote}</p>
      </article>

      <div className="no-print">
        <PrintButton label={t.receipt.print} />
      </div>
    </>
  );
}
