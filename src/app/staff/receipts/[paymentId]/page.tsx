import Link from "next/link";
import { notFound } from "next/navigation";
import { ReceiptView } from "@/components/receipt-view";
import { messages } from "@/i18n";
import { requireUser } from "@/lib/auth";
import { staffReceipt } from "@/lib/ledger";
import { getLocale } from "@/lib/locale";

export default async function StaffReceiptPage({
  params,
}: {
  params: Promise<{ paymentId: string }>;
}) {
  await requireUser("accounts");
  const { paymentId } = await params;

  const receipt = await staffReceipt(paymentId);
  if (!receipt) notFound();

  const locale = await getLocale();
  const t = messages(locale);

  return (
    <div className="flex max-w-[640px] flex-col gap-6">
      <Link
        href={`/staff/students/${receipt.studentId}`}
        className="no-print inline-block min-h-12 py-3 font-medium underline underline-offset-4"
      >
        {t.receipt.back}
      </Link>
      <ReceiptView receipt={receipt} locale={locale} t={t} />
    </div>
  );
}
