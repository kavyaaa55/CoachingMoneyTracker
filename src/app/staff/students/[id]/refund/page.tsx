import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ActionForm } from "@/components/action-form";
import { buttonStyles } from "@/components/button-styles";
import { RefundWorking, type Working } from "@/components/refund-working";
import { TextField } from "@/components/text-field";
import { summariseLedger } from "@/domain/instalments";
import { calculateRefund, canSaveExit, isPlausibleExitDate } from "@/domain/refund";
import { messages } from "@/i18n";
import { requireUser } from "@/lib/auth";
import { today } from "@/lib/clock";
import { instalmentsOf } from "@/lib/ledger";
import { getLocale } from "@/lib/locale";
import { refundOf } from "@/lib/refunds";
import { studentById } from "@/lib/staff-students";
import { saveStudentRefund } from "./actions";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ exit?: string | string[] }>;
};

export default async function RefundPage({ params, searchParams }: Props) {
  await requireUser("accounts");
  const { id } = await params;
  const { exit } = await searchParams;

  const student = await studentById(id);
  if (!student) notFound();

  const locale = await getLocale();
  const t = messages(locale);
  const r = t.staff.refund;
  const date = today();

  const fixed = {
    planTotal: student.planTotal,
    discount: student.discount,
    termStart: student.termStart,
    termEnd: student.termEnd,
  };

  const saved = await refundOf(id);
  let working: Working | null = null;
  let invalidDate = false;

  if (saved) {
    working = {
      ...fixed,
      netFee: saved.netFeePaise,
      paid: saved.paidPaise,
      exitDate: saved.exitDate,
      termDays: saved.termDays,
      daysUsed: saved.daysUsed,
      feeUsed: saved.feeUsedPaise,
      refund: saved.refundPaise,
      shortfall: Math.max(0, saved.feeUsedPaise - saved.paidPaise),
      dueBy: saved.dueBy,
    };
  } else if (exit !== undefined) {
    const parsed = z.iso.date().safeParse(exit);

    if (parsed.success && isPlausibleExitDate(parsed.data, student.termStart, student.termEnd)) {
      const { paid } = summariseLedger(await instalmentsOf(id), date);
      const netFee = student.planTotal - student.discount;
      const exitDate = parsed.data;
      const result = calculateRefund({ ...fixed, netFee, paid, exitDate });
      working = { ...fixed, ...result, netFee, paid, exitDate };
    } else {
      invalidDate = true;
    }
  }

  return (
    <div className="flex max-w-[560px] flex-col gap-6 pb-8">
      <div>
        <Link
          href={`/staff/students/${id}`}
          className="inline-block min-h-12 py-3 font-medium underline underline-offset-4"
        >
          {r.back}
        </Link>
        <h1 className="text-[32px] leading-10 font-medium">{r.title}</h1>
        <p className="mt-1 text-muted">
          {student.name} · {student.code}
        </p>
      </div>

      {saved ? (
        <p role="status" className="rounded-md bg-paid-tint px-4 py-3 text-paid">
          {r.saved}
        </p>
      ) : (
        <form className="flex flex-col gap-3">
          {!working && !invalidDate && <p className="text-muted">{r.intro}</p>}
          <TextField
            name="exit"
            label={r.exitDate}
            type="date"
            defaultValue={working?.exitDate ?? date}
          />
          {invalidDate && (
            <p role="alert" className="rounded-md bg-error-tint px-4 py-3 text-error">
              {r.invalidDate}
            </p>
          )}
          <button type="submit" className={buttonStyles.secondary}>
            {r.calculate}
          </button>
        </form>
      )}

      {working && <RefundWorking working={working} today={date} locale={locale} t={t} />}

      {working && !saved &&
        (canSaveExit(working.exitDate, date) ? (
          <div className="flex flex-col gap-3">
            <p className="text-muted">{r.saveHint}</p>
            <ActionForm action={saveStudentRefund} label={r.save} pendingLabel={r.saving}>
              <input type="hidden" name="studentId" value={id} />
              <input type="hidden" name="exitDate" value={working.exitDate} />
            </ActionForm>
          </div>
        ) : (
          <p className="rounded-md bg-highlight px-4 py-3">{r.previewOnly}</p>
        ))}

      <Link
        href="/refund-policy"
        className="self-center px-2 py-3 font-medium underline underline-offset-4"
      >
        {r.policy}
      </Link>
    </div>
  );
}
