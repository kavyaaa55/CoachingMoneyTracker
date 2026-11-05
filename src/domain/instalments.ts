import { daysBetween, type IsoDate } from "./dates";
import type { Paise } from "./money";

export type Instalment = { dueDate: IsoDate; amount: Paise; paid: Paise };

export type InstalmentStatus =
  | { kind: "paid" }
  | { kind: "overdue"; days: number; partPaid: boolean }
  | { kind: "due"; days: number; partPaid: boolean };

export const balanceOf = (instalment: Instalment): Paise =>
  Math.max(0, instalment.amount - instalment.paid);

export function instalmentStatus(instalment: Instalment, today: IsoDate): InstalmentStatus {
  if (balanceOf(instalment) === 0) return { kind: "paid" };

  const partPaid = instalment.paid > 0;
  const daysLate = daysBetween(instalment.dueDate, today);

  return daysLate > 0
    ? { kind: "overdue", days: daysLate, partPaid }
    : { kind: "due", days: Math.abs(daysLate), partPaid };
}

/** The oldest unpaid instalment, plus anything else already overdue behind it. */
export function nextToPay<T extends Instalment>(instalments: T[], today: IsoDate) {
  const unpaid = instalments
    .filter((instalment) => balanceOf(instalment) > 0)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  if (unpaid.length === 0) return null;

  const [next, ...rest] = unpaid;
  const otherOverdue = rest
    .filter((instalment) => daysBetween(instalment.dueDate, today) > 0)
    .reduce((sum, instalment) => sum + balanceOf(instalment), 0);

  return { next, otherOverdue };
}
