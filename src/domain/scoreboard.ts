import { addDays, type IsoDate } from "./dates";
import type { Paise } from "./money";

/** The brief's success measures. */
export const LATE_AFTER_DAYS = 60;
export const REPLY_WINDOW_DAYS = 3;
export const BRIEF_LATE_PERCENT = { baseline: 12, target: 6 };
export const BRIEF_CLOSE_DAYS = { baseline: 4, target: 1 };

export type DatedPayment = { amount: Paise; paidOn: IsoDate };

export type ScoredInstalment = {
  dueDate: IsoDate;
  amount: Paise;
  centre: string;
  payments: DatedPayment[];
};

export type LateShare = { measured: Paise; late: Paise; percent: number | null };

/**
 * Assumption, see CLAUDE.md. Counted per rupee, and only for instalments that have been due for
 * at least 60 days: a newer one cannot be 60 days late yet, and counting it would flatter the
 * figure. Money still unpaid after 60 days is late too, as it is the worst case of arriving late.
 */
export function lateShare(instalments: ScoredInstalment[], today: IsoDate): LateShare {
  let measured = 0;
  let late = 0;

  for (const { dueDate, amount, payments } of instalments) {
    const limit = addDays(dueDate, LATE_AFTER_DAYS);
    if (limit > today) continue;

    const inTime = payments
      .filter((payment) => payment.paidOn <= limit)
      .reduce((sum, payment) => sum + payment.amount, 0);
    measured += amount;
    late += Math.max(0, amount - inTime);
  }

  return {
    measured,
    late,
    percent: measured === 0 ? null : Math.round((late / measured) * 1000) / 10,
  };
}

function shareBy(
  instalments: ScoredInstalment[],
  today: IsoDate,
  keyOf: (item: ScoredInstalment) => string,
) {
  const groups = new Map<string, ScoredInstalment[]>();
  for (const item of instalments) {
    groups.set(keyOf(item), [...(groups.get(keyOf(item)) ?? []), item]);
  }

  return [...groups.entries()]
    .map(([key, rows]) => ({ key, ...lateShare(rows, today) }))
    .filter((row) => row.measured > 0)
    .sort((a, b) => a.key.localeCompare(b.key));
}

export const lateShareByMonth = (instalments: ScoredInstalment[], today: IsoDate) =>
  shareBy(instalments, today, (item) => item.dueDate.slice(0, 7));

export const lateShareByCentre = (instalments: ScoredInstalment[], today: IsoDate) =>
  shareBy(instalments, today, (item) => item.centre);

type SentReminder = { instalmentId: string; sentOn: IsoDate };
type InstalmentPayment = { instalmentId: string; paidOn: IsoDate };

/** How many reminders had a payment soon after. Timing only: it does not prove the cause. */
export function paidAfterReminder(sent: SentReminder[], payments: InstalmentPayment[]) {
  const followed = sent.filter(({ instalmentId, sentOn }) =>
    payments.some(
      (payment) =>
        payment.instalmentId === instalmentId &&
        payment.paidOn >= sentOn &&
        payment.paidOn <= addDays(sentOn, REPLY_WINDOW_DAYS),
    ),
  ).length;

  return { sent: sent.length, followed };
}
