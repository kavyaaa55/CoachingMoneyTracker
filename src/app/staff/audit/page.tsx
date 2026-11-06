import Link from "next/link";
import { DataTable } from "@/components/data-table";
import { formatDate, messages } from "@/i18n";
import { AUDIT_PER_PAGE, recentAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { istDate } from "@/lib/clock";
import { getLocale } from "@/lib/locale";

const detailText = (detail: Record<string, unknown>) =>
  Object.entries(detail)
    .map(([key, value]) => `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`)
    .join(" · ");

export default async function AuditPage() {
  await requireUser("accounts");
  const locale = await getLocale();
  const t = messages(locale);
  const a = t.staff.audit;

  const rows = await recentAudit();

  return (
    <>
      <div className="max-w-[640px]">
        <Link
          href="/staff/books"
          className="inline-block min-h-12 py-3 font-medium underline underline-offset-4"
        >
          {a.back}
        </Link>
        <h1 className="text-[32px] leading-10 font-medium">{a.title}</h1>
        <p className="mt-2 text-muted">{a.intro(AUDIT_PER_PAGE)}</p>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-md border border-divider bg-surface p-6 text-muted">{a.empty}</p>
      ) : (
        <div className="pb-8">
          <DataTable
            rows={rows}
            rowKey={(row) => row.id}
            columns={[
              { header: a.when, cell: (row) => formatDate(istDate(row.at), locale) },
              { header: a.who, cell: (row) => row.actor ?? "-" },
              { header: a.what, cell: (row) => a.actions[row.action] },
              {
                header: a.detail,
                cell: (row) => <span className="break-all text-muted">{detailText(row.detail)}</span>,
              },
            ]}
          />
        </div>
      )}
    </>
  );
}
