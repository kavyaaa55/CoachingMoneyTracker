import type { IsoDate } from "@/domain/dates";

/** Today in India, or the fixed demo date when APP_TODAY is set. */
export function today(): IsoDate {
  const fixed = process.env.APP_TODAY;
  if (fixed) return fixed;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

/** The current time on the app's date, so demo payments land on the demo day. */
export function nowOnAppDate(): Date {
  return new Date(`${today()}T${new Date().toISOString().slice(11)}`);
}
