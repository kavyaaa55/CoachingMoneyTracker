import Link from "next/link";
import { buttonStyles } from "@/components/button-styles";
import { StatusChip } from "@/components/status-chip";
import { TopBar } from "@/components/top-bar";
import { balanceOf, instalmentStatus } from "@/domain/instalments";
import { formatInr } from "@/domain/money";
import { formatDate, messages } from "@/i18n";
import { requireParent } from "@/lib/auth";
import { today } from "@/lib/clock";
import { instalmentsOf, matchedPaymentsOf } from "@/lib/ledger";
import { getLocale } from "@/lib/locale";
import { payLinkFor } from "@/lib/pay-links";

export default async function InstalmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string }>;
}) {
  const { children } = await requireParent();
  const { student } = await searchParams;
  const locale = await getLocale();
  const t = messages(locale);
  const child = children.find((item) => item.id === student) ?? children[0];

  const [instalments, receipts] = child
    ? await Promise.all([instalmentsOf(child.id), matchedPaymentsOf(child.id)])
    : [[], []];
  const date = today();

  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col gap-6 px-4 py-4">
      <TopBar locale={locale} showSignOut />
      <div>
        <Link
          href={child ? `/parent?student=${child.id}` : "/parent"}
          className="inline-block min-h-12 py-3 font-medium underline underline-offset-4"
        >
          {t.instalments.back}
        </Link>
        <h1 className="text-[32px] leading-10 font-medium">{t.instalments.title}</h1>
        {child && <p className="mt-1 text-muted">{child.name}</p>}
      </div>

      {instalments.length === 0 ? (
        <p className="text-muted">{t.home.noPlan}</p>
      ) : (
        <ul className="divide-y divide-divider rounded-md border border-divider bg-surface">
          {instalments.map((instalment) => {
            const status = instalmentStatus(instalment, date);
            const balance = balanceOf(instalment);
            const own = receipts.filter((item) => item.instalmentId === instalment.id);

            return (
              <li key={instalment.id} className="flex flex-col gap-2 p-4">
                <div className="flex items-baseline justify-between gap-4">
                  <p className="font-medium">
                    {t.instalments.item(instalment.sequence, instalments.length)}
                  </p>
                  <p className="font-medium">{formatInr(instalment.amount)}</p>
                </div>
                <p className="text-sm text-muted">
                  {t.instalments.dueOn(formatDate(instalment.dueDate, locale))}
                </p>
                <div>
                  {child?.exitDate && balance > 0 ? (
                    <span className="inline-block rounded-sm bg-highlight px-2 py-0.5 text-[13px] font-medium">
                      {t.instalments.closed}
                    </span>
                  ) : (
                    <StatusChip status={status} t={t} />
                  )}
                </div>
                {!child?.exitDate && instalment.paid > 0 && balance > 0 && (
                  <p className="text-sm">{t.instalments.balance(formatInr(balance))}</p>
                )}
                {own.map((item) => (
                  <Link
                    key={item.id}
                    href={`/parent/receipts/${item.id}`}
                    className="inline-block py-2 text-sm font-medium underline underline-offset-4"
                  >
                    {t.instalments.receipt(item.receiptNo ?? "")}
                  </Link>
                ))}
                {!child?.exitDate && balance > 0 && (
                  <Link
                    href={payLinkFor(instalment.id)}
                    className={buttonStyles.secondary}
                  >
                    {t.instalments.pay(formatInr(balance))}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Link
        href="/refund-policy"
        className="block py-4 text-center font-medium underline underline-offset-4"
      >
        {t.refundPolicy.link}
      </Link>
    </main>
  );
}
