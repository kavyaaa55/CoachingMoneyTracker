import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { GST_RATE_PERCENT, SAMPLE_GSTIN, splitGst } from "@/domain/gst";
import { formatInr } from "@/domain/money";
import { formatDate, messages } from "@/i18n";
import { requireUser } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { creditNote } from "@/lib/refunds";

export default async function CreditNotePage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser("accounts");
  const { id } = await params;

  const note = await creditNote(id);
  if (!note) notFound();

  const locale = await getLocale();
  const t = messages(locale);
  const c = t.staff.creditNote;
  const { taxable, cgst, sgst } = splitGst(note.amount);
  const halfRate = String(GST_RATE_PERCENT / 2);

  const details = [
    [c.number, note.number],
    [c.date, note.paidOn && formatDate(note.paidOn, locale)],
    [c.student, note.studentName],
    [c.studentId, note.studentCode],
    [c.batch, note.batch],
    [c.reason, c.reasonValue(formatDate(note.exitDate, locale))],
    [c.paidBy, note.method && t.paymentMethods[note.method]],
    [c.reference, note.reference],
  ];
  const amounts = [
    [t.receipt.taxable, formatInr(taxable)],
    [t.receipt.cgst(halfRate), formatInr(cgst)],
    [t.receipt.sgst(halfRate), formatInr(sgst)],
  ];

  return (
    <div className="flex max-w-[560px] flex-col gap-6 pb-8">
      <Link
        href={`/staff/students/${note.studentId}/refund`}
        className="no-print inline-block min-h-12 py-3 font-medium underline underline-offset-4"
      >
        {c.back}
      </Link>

      <article className="rounded-md border border-divider bg-surface p-6">
        <header>
          <p className="text-sm text-muted">
            {t.institute}, {t.city} · {t.receipt.gstin} {SAMPLE_GSTIN}
          </p>
          <h1 className="mt-1 text-[32px] leading-10 font-medium">{c.title}</h1>
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
            <dd>{formatInr(note.amount)}</dd>
          </div>
        </dl>

        <p className="mt-6 text-sm text-muted">{c.sampleNote}</p>
      </article>

      <div className="no-print">
        <PrintButton label={t.receipt.print} />
      </div>
    </div>
  );
}
