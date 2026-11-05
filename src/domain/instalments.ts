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
