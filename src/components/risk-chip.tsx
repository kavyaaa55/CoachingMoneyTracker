import type { Messages } from "@/i18n/en";

const styles = {
  watch: "bg-highlight text-ink",
  high: "bg-overdue-tint text-overdue",
};

/** A band in words, never a score, because the flag is uncertain and should look it. */
export function RiskChip({ band, t }: { band: "watch" | "high"; t: Messages }) {
  return (
    <span
      className={`inline-block shrink-0 rounded-sm px-2 py-0.5 text-[13px] font-medium whitespace-nowrap ${styles[band]}`}
    >
      {t.staff.tasks.bands[band]}
    </span>
  );
}
