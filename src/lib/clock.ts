import type { IsoDate } from "@/domain/dates";

const demo = globalThis as { demoToday?: IsoDate };

/** Moves the demo date. Only the time machine calls this, and only in demo mode. */
export function setDemoToday(date: IsoDate | null) {
  demo.demoToday = date ?? undefined;
}

/** Today in India, or the demo date when one is set. */
export function today(): IsoDate {
  const fixed = demo.demoToday ?? process.env.APP_TODAY;
  if (fixed) return fixed;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

const indiaDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" });

/** The date in India at a moment in time. Receipts and exports must use this, never UTC. */
export const istDate = (moment: Date): IsoDate => indiaDate.format(moment);

/** The current time of day on a given date, so replayed events land on their own day. */
export function timeOn(date: IsoDate): Date {
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(new Date());
  return new Date(`${date}T${time}+05:30`);
}

/** The current time on the app's date, so demo payments land on the demo day. */
export const nowOnAppDate = (): Date => timeOn(today());
