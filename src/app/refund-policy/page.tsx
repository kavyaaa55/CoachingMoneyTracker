import Link from "next/link";
import { PrintButton } from "@/components/print-button";
import { TopBar } from "@/components/top-bar";
import { formatInr, rupees } from "@/domain/money";
import { calculateRefund, REFUND_DEADLINE_DAYS } from "@/domain/refund";
import { formatDate, messages } from "@/i18n";
import { getLocale } from "@/lib/locale";

/** Worked through the real rule, so the example can never disagree with it. */
const EXAMPLE = {
  netFee: rupees(120000),
  paid: rupees(45000),
  termStart: "2026-07-01",
  termEnd: "2027-06-30",
  exitDate: "2026-10-12",
};

/** Public on purpose: the brief requires a published policy, so there is no sign-in. */
export default async function RefundPolicyPage() {
  const locale = await getLocale();
  const t = messages(locale);
  const p = t.refundPolicy;

  const example = calculateRefund(EXAMPLE);
  const lines = [
    [p.exampleNetFee, formatInr(EXAMPLE.netFee)],
    [p.examplePaid, formatInr(EXAMPLE.paid)],
    [p.exampleLeft(formatDate(EXAMPLE.exitDate, locale), example.daysUsed), ""],
    [p.exampleFeeUsed, formatInr(example.feeUsed)],
    [p.exampleRefund, formatInr(example.refund)],
    [p.exampleDueBy, formatDate(example.dueBy, locale)],
  ];

  return (
    <main className="mx-auto flex min-h-dvh max-w-[640px] flex-col gap-6 px-4 py-4">
      <div className="no-print">
        <TopBar locale={locale} />
        <Link href="/" className="inline-block min-h-12 py-3 font-medium underline underline-offset-4">
          {p.back}
        </Link>
      </div>

      <article className="flex flex-col gap-6 rounded-md border border-divider bg-surface p-6">
        <header>
          <p className="text-sm text-muted">{t.institute}, {t.city}</p>
          <h1 className="mt-1 text-[32px] leading-10 font-medium">{p.title}</h1>
          <p className="mt-3">{p.intro}</p>
        </header>

        <section>
          <h2 className="text-xl leading-7 font-medium">{p.howTitle}</h2>
          <p className="mt-2 font-medium">{p.howFee}</p>
          <p className="mt-1 font-medium">{p.howRefund}</p>
          <p className="mt-2 text-muted">{p.howNotes}</p>
        </section>

        <section>
          <h2 className="text-xl leading-7 font-medium">{p.nothingElseTitle}</h2>
          <p className="mt-2">{p.nothingElse}</p>
        </section>

        <section>
          <h2 className="text-xl leading-7 font-medium">{p.whenTitle}</h2>
          <p className="mt-2">{p.when(REFUND_DEADLINE_DAYS)}</p>
        </section>

        <section>
          <h2 className="text-xl leading-7 font-medium">{p.casesTitle}</h2>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
            <li>{p.caseBefore}</li>
            <li>{p.caseAfter}</li>
            <li>{p.caseUnderpaid}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl leading-7 font-medium">{p.exampleTitle}</h2>
          <p className="mt-2 text-muted">
            {p.exampleIntro(
              formatDate(EXAMPLE.termStart, locale),
              formatDate(EXAMPLE.termEnd, locale),
              example.termDays,
            )}
          </p>
          <dl className="mt-2 divide-y divide-divider">
            {lines.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 py-2">
                <dt className="text-muted">{label}</dt>
                <dd className="text-right">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section>
          <h2 className="text-xl leading-7 font-medium">{p.basisTitle}</h2>
          <p className="mt-2">{p.basis}</p>
        </section>

        <section>
          <h2 className="text-xl leading-7 font-medium">{p.questionsTitle}</h2>
          <p className="mt-2">{p.questions}</p>
        </section>

        <p className="text-sm text-muted">{p.sampleNote}</p>
      </article>

      <div className="no-print pb-4">
        <PrintButton label={p.print} />
      </div>
    </main>
  );
}
