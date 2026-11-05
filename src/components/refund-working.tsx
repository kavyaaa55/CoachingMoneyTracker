import type { IsoDate } from "@/domain/dates";
import { instalmentStatus } from "@/domain/instalments";
import { formatInr, type Paise } from "@/domain/money";
import { formatDate, timingLabel, type Locale } from "@/i18n";
import type { Messages } from "@/i18n/en";

export type Working = {
  planTotal: Paise;
  discount: Paise;
  netFee: Paise;
  paid: Paise;
  termStart: IsoDate;
  termEnd: IsoDate;
  exitDate: IsoDate;
  termDays: number;
  daysUsed: number;
  feeUsed: Paise;
  refund: Paise;
  shortfall: Paise;
  dueBy: IsoDate;
};

type Props = { working: Working; today: IsoDate; locale: Locale; t: Messages };

/** Every line of a refund, then the result and the deadline. */
export function RefundWorking({ working, today, locale, t }: Props) {
  const r = t.staff.refund;
  const { netFee, paid, feeUsed, refund, daysUsed, termDays, dueBy } = working;

  const lines = [
    { label: r.plan, value: formatInr(working.planTotal) },
    { label: r.discount, value: formatInr(working.discount) },
    { label: r.netFee, value: formatInr(netFee) },
    {
      label: r.term,
      value: r.termDates(
        formatDate(working.termStart, locale),
        formatDate(working.termEnd, locale),
        termDays,
      ),
    },
    { label: r.left, value: formatDate(working.exitDate, locale) },
    { label: r.daysUsed, value: r.daysUsedValue(daysUsed, termDays) },
    {
      label: r.feeUsed,
      sum: r.feeUsedSum(formatInr(netFee), daysUsed, termDays),
      value: formatInr(feeUsed),
    },
    { label: r.paid, value: formatInr(paid) },
    {
      label: r.paidMinusUsed,
      sum: r.refundSum(formatInr(paid), formatInr(feeUsed)),
      value: formatInr(refund),
    },
  ];

  // A refund deadline counts down the same way an instalment does.
  const deadline = instalmentStatus({ dueDate: dueBy, amount: refund, paid: 0 }, today);
  const isLate = deadline.kind === "overdue";

  const note =
    working.exitDate < working.termStart
      ? r.beforeTerm
      : working.exitDate > working.termEnd
        ? r.afterTerm
        : null;

  return (
    <>
      <dl className="divide-y divide-divider rounded-md border border-divider bg-surface px-4">
        {lines.map((line) => (
          <div key={line.label} className="flex justify-between gap-4 py-3">
            <dt>
              <span className="text-muted">{line.label}</span>
              {line.sum && <span className="block text-sm text-muted">{line.sum}</span>}
            </dt>
            <dd className="text-right">{line.value}</dd>
          </div>
        ))}
      </dl>

      {note && <p className="text-muted">{note}</p>}

      <section>
        <p>{r.result}</p>
        <p className="mt-2 text-amount font-medium">{formatInr(refund)}</p>
        {refund > 0 ? (
          <p className={`mt-2 text-lg leading-7 ${isLate ? "font-medium text-overdue" : "text-muted"}`}>
            {r.dueBy(formatDate(dueBy, locale))} · {timingLabel(deadline, t)}
          </p>
        ) : (
          <p className="mt-2 text-lg leading-7 text-muted">{r.noRefund}</p>
        )}
        {working.shortfall > 0 && (
          <p className="mt-1 text-muted">{r.shortfall(formatInr(working.shortfall))}</p>
        )}
      </section>
    </>
  );
}
