/** A calendar date as YYYY-MM-DD. Using strings avoids time zone drift. */
export type IsoDate = string;

const DAY_MS = 86_400_000;

function toUtc(date: IsoDate): number {
  const time = Date.parse(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(time)) {
    throw new Error(`Invalid date: ${date}`);
  }
  return time;
}

/** Whole days from one date to another. Negative when `to` is earlier. */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return new Date(toUtc(date) + days * DAY_MS).toISOString().slice(0, 10);
}
