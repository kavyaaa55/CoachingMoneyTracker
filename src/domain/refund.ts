import { addDays, daysBetween, type IsoDate } from "./dates";
import type { Paise } from "./money";

/** The brief requires a pro-rata refund within 10 days of a student leaving. */
export const REFUND_DEADLINE_DAYS = 10;

export type RefundInput = {
  netFee: Paise;
  paid: Paise;
  termStart: IsoDate;
  termEnd: IsoDate;
  exitDate: IsoDate;
};

export type RefundResult = {
  termDays: number;
  daysUsed: number;
  feeUsed: Paise;
  refund: Paise;
  /** Fee used but not yet paid. Shown to staff, never collected automatically. */
  shortfall: Paise;
  dueBy: IsoDate;
};

const toWholeRupee = (paise: number): Paise => Math.round(paise / 100) * 100;

/**
 * Assumption, see CLAUDE.md: refund = paid - (net fee x days used / term days).
 * Days count both end dates, and the fee used is rounded to the whole rupee.
 */
export function calculateRefund(input: RefundInput): RefundResult {
  const { netFee, paid, termStart, termEnd, exitDate } = input;

  if (netFee < 0 || paid < 0) throw new Error("Amounts cannot be negative");

  const termDays = daysBetween(termStart, termEnd) + 1;
  if (termDays < 1) throw new Error("Term must end after it starts");

  const daysUsed = Math.min(termDays, Math.max(0, daysBetween(termStart, exitDate) + 1));
  const feeUsed = toWholeRupee((netFee * daysUsed) / termDays);

  return {
    termDays,
    daysUsed,
    feeUsed,
    refund: Math.max(0, paid - feeUsed),
    shortfall: Math.max(0, feeUsed - paid),
    dueBy: addDays(exitDate, REFUND_DEADLINE_DAYS),
  };
}
