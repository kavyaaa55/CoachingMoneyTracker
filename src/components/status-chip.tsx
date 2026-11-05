import type { InstalmentStatus } from "@/domain/instalments";
import { statusLabel } from "@/i18n";
import type { Messages } from "@/i18n/en";

const styles = {
  paid: "bg-paid-tint text-paid",
  overdue: "bg-overdue-tint text-overdue",
  due: "bg-highlight text-ink",
};

export function StatusChip({ status, t }: { status: InstalmentStatus; t: Messages }) {
  return (
    <span className={`inline-block rounded-sm px-2 py-0.5 text-[13px] font-medium ${styles[status.kind]}`}>
      {statusLabel(status, t)}
    </span>
  );
}
