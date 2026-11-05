import Link from "next/link";
import { notFound } from "next/navigation";
import { ReceiptView } from "@/components/receipt-view";
import { messages } from "@/i18n";
import { requireParent } from "@/lib/auth";
import { receiptFor } from "@/lib/ledger";
import { getLocale } from "@/lib/locale";

export default async function ParentReceiptPage({
  params,
}: {
  params: Promise<{ paymentId: string }>;
}) {
  const { user } = await requireParent();
  const { paymentId } = await params;

  const receipt = await receiptFor(paymentId, user.id);
  if (!receipt) notFound();

  const locale = await getLocale();
  const t = messages(locale);

  return (
    <main className="mx-auto flex min-h-dvh max-w-[640px] flex-col gap-6 px-4 py-4">
      <Link
        href="/parent"
        className="no-print inline-block min-h-12 py-3 font-medium underline underline-offset-4"
      >
        {t.receipt.back}
      </Link>
      <ReceiptView receipt={receipt} locale={locale} t={t} />
    </main>
  );
}
