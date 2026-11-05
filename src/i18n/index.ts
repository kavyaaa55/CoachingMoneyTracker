import type { IsoDate } from "@/domain/dates";
import type { InstalmentStatus } from "@/domain/instalments";
import { en, type Messages } from "./en";
import { hi } from "./hi";

export type Locale = "en" | "hi";

export function messages(locale: Locale): Messages {
  return locale === "hi" ? hi : en;
}

export function formatDate(date: IsoDate, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "hi" ? "hi-IN" : "en-IN", {
    day: "numeric",
    month: locale === "hi" ? "long" : "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

/** When an unpaid instalment falls due, for example "23 days overdue". */
export function timingLabel(status: InstalmentStatus, t: Messages): string {
  if (status.kind === "paid") return t.status.paid;
  if (status.kind === "overdue") return t.status.overdue(status.days);
  return status.days === 0 ? t.status.dueToday : t.status.dueIn(status.days);
}

/** The full status phrase, for example "Part paid, 23 days overdue". */
export function statusLabel(status: InstalmentStatus, t: Messages): string {
  const timing = timingLabel(status, t);
  return status.kind !== "paid" && status.partPaid ? `${t.status.partPaid}, ${timing}` : timing;
}
