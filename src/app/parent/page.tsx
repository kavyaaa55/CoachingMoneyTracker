import Link from "next/link";
import { buttonStyles } from "@/components/button-styles";
import { TopBar } from "@/components/top-bar";
import { instalmentStatus, balanceOf, nextToPay } from "@/domain/instalments";
import { formatInr } from "@/domain/money";
import { formatDate, messages, timingLabel } from "@/i18n";
import { requireParent } from "@/lib/auth";
import { today } from "@/lib/clock";
import { instalmentsOf } from "@/lib/ledger";
import { getLocale } from "@/lib/locale";
import { payLinkFor } from "@/lib/pay-links";
import { refundOf } from "@/lib/refunds";

type Query = { student?: string; payment?: string; receipt?: string };

export default async function ParentHome({ searchParams }: { searchParams: Promise<Query> }) {
  const { children } = await requireParent();
  const query = await searchParams;
  const locale = await getLocale();
  const t = messages(locale);

  if (children.length === 0) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col gap-8 px-4 py-4">
        <TopBar locale={locale} showSignOut />
        <h1 className="font-normal text-muted">{t.parent.noChildren}</h1>
      </main>
    );
  }

  const child = children.find((item) => item.id === query.student) ?? children[0];
  const [instalments, refund] = await Promise.all([instalmentsOf(child.id), refundOf(child.id)]);
  const date = today();
  const dues = nextToPay(instalments, date);
  const listHref = `/parent/instalments?student=${child.id}`;
  const status = dues && instalmentStatus(dues.next, date);
  const isOverdue = status?.kind === "overdue";

  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col px-4 py-4">
      <TopBar locale={locale} showSignOut />

      {children.length > 1 && (
        <nav className="mt-4 flex gap-4">
          {children.map((item) => (
            <Link
              key={item.id}
              href={`/parent?student=${item.id}`}
              aria-current={item.id === child.id ? "page" : undefined}
              className={
                item.id === child.id
                  ? "min-h-12 py-3 font-medium underline underline-offset-4"
                  : "min-h-12 py-3 text-muted"
              }
            >
              {item.name.split(" ")[0]}
            </Link>
          ))}
        </nav>
      )}

      {query.payment === "received" && (
        <p role="status" className="mt-4 rounded-md bg-paid-tint px-4 py-3 text-paid">
          {t.home.paymentReceived}{" "}
          {query.receipt && (
            <Link href={`/parent/receipts/${query.receipt}`} className="font-medium underline underline-offset-4">
              {t.home.viewReceipt}
            </Link>
          )}
        </p>
      )}
      {query.payment === "checking" && (
        <p role="status" className="mt-4 rounded-md bg-highlight px-4 py-3">
          {t.home.paymentChecking}
        </p>
      )}

      {refund ? (
        <>
          <section className="mt-10">
            <h1 className="font-normal">{t.home.refundFor(child.name)}</h1>
            <p className="mt-2 text-amount font-medium">{formatInr(refund.refundPaise)}</p>
            <p className="mt-2 text-lg leading-7 text-muted">
              {refund.refundPaise > 0
                ? t.home.refundDueBy(formatDate(refund.dueBy, locale))
                : t.home.noRefund}
            </p>
            <p className="mt-1 text-muted">{t.home.leftOn(formatDate(refund.exitDate, locale))}</p>
          </section>
          <div className="mt-auto pt-10">
            <Link href={listHref} className="block py-4 text-center font-medium underline underline-offset-4">
              {t.home.seeReceipts}
            </Link>
          </div>
        </>
      ) : instalments.length === 0 ? (
        <h1 className="mt-10 font-normal text-muted">{t.home.noPlan}</h1>
      ) : dues && status ? (
        <>
          <section className="mt-10">
            <h1 className="font-normal">
              {isOverdue ? t.home.amountDueFor(child.name) : t.home.nextPaymentFor(child.name)}
            </h1>
            <p className="mt-2 text-amount font-medium">{formatInr(balanceOf(dues.next))}</p>
            <p className={`mt-2 text-lg leading-7 ${isOverdue ? "font-medium text-overdue" : "text-muted"}`}>
              {t.home.dueOn(formatDate(dues.next.dueDate, locale))} · {timingLabel(status, t)}
            </p>
            {dues.otherOverdue > 0 && (
              <p className="mt-1 text-overdue">{t.home.moreOverdue(formatInr(dues.otherOverdue))}</p>
            )}
          </section>
          <div className="mt-auto pt-10">
            <Link
              href={payLinkFor(dues.next.id)}
              className={buttonStyles.primary}
            >
              {t.home.pay(formatInr(balanceOf(dues.next)))}
            </Link>
            <Link href={listHref} className="block py-4 text-center font-medium underline underline-offset-4">
              {t.home.seeInstalments}
            </Link>
          </div>
        </>
      ) : (
        <>
          <section className="mt-10">
            <h1 className="font-normal">{child.name}</h1>
            <p className="mt-2 text-amount font-medium">{t.home.allPaid}</p>
            <p className="mt-2 text-lg leading-7 font-medium text-paid">{t.home.nothingDue}</p>
          </section>
          <div className="mt-auto pt-10">
            <Link href={listHref} className="block py-4 text-center font-medium underline underline-offset-4">
              {t.home.seeReceipts}
            </Link>
          </div>
        </>
      )}
    </main>
  );
}
