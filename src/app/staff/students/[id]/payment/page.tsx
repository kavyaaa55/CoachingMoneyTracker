import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { TextField } from "@/components/text-field";
import { balanceOf } from "@/domain/instalments";
import { formatInr } from "@/domain/money";
import { formatDate, messages } from "@/i18n";
import { requireUser } from "@/lib/auth";
import { today } from "@/lib/clock";
import { instalmentsOf } from "@/lib/ledger";
import { getLocale } from "@/lib/locale";
import { MANUAL_METHODS } from "@/lib/payments";
import { studentById } from "@/lib/staff-students";
import { recordManualPayment } from "./actions";

export default async function RecordPaymentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser("accounts");
  const { id } = await params;

  const student = await studentById(id);
  if (!student) notFound();

  const locale = await getLocale();
  const t = messages(locale);
  const p = t.staff.payment;
  const date = today();

  const unpaid = (await instalmentsOf(id)).filter((item) => balanceOf(item) > 0);
  const selectClass = "h-12 w-full rounded-md border border-control bg-surface px-3";

  return (
    <div className="flex max-w-[560px] flex-col gap-6 pb-8">
      <div>
        <h1 className="text-[32px] leading-10 font-medium">{p.title}</h1>
        <p className="mt-1 text-muted">
          {student.name} · {student.code}
        </p>
      </div>

      {student.exitDate || unpaid.length === 0 ? (
        <p className="rounded-md border border-divider bg-surface p-6 text-muted">
          {student.exitDate ? p.studentLeft : p.nothingDue}
        </p>
      ) : (
        <ActionForm action={recordManualPayment} label={p.save} pendingLabel={p.saving}>
          <input type="hidden" name="studentId" value={id} />
          <input type="hidden" name="attempt" value={randomUUID()} />
          <div className="flex flex-col gap-2">
            <label htmlFor="instalmentId" className="font-medium">
              {p.instalment}
            </label>
            <select id="instalmentId" name="instalmentId" required className={selectClass}>
              {unpaid.map((item) => (
                <option key={item.id} value={item.id}>
                  {p.option(
                    item.sequence,
                    formatInr(balanceOf(item)),
                    formatDate(item.dueDate, locale),
                  )}
                </option>
              ))}
            </select>
          </div>
          <TextField name="amount" label={p.amount} inputMode="decimal" maxLength={20} autoComplete="off" />
          <div className="flex flex-col gap-2">
            <label htmlFor="method" className="font-medium">
              {p.method}
            </label>
            <select id="method" name="method" required className={selectClass}>
              {MANUAL_METHODS.map((method) => (
                <option key={method} value={method}>
                  {t.paymentMethods[method]}
                </option>
              ))}
            </select>
          </div>
          <TextField
            name="reference"
            label={p.reference}
            hint={p.referenceHint}
            required={false}
            maxLength={60}
            autoComplete="off"
          />
          <TextField name="paidOn" label={p.date} type="date" defaultValue={date} max={date} />
        </ActionForm>
      )}

      <Link
        href={`/staff/students/${id}`}
        className="self-center px-2 py-3 font-medium underline underline-offset-4"
      >
        {p.cancel}
      </Link>
    </div>
  );
}
