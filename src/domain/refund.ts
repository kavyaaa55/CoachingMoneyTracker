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

/** Keeps a mistyped year out of the working. Far wider than any real exit. */
const EXIT_DATE_MARGIN_DAYS = 365;

export function isPlausibleExitDate(exitDate: IsoDate, termStart: IsoDate, termEnd: IsoDate) {
  return (
    daysBetween(termStart, exitDate) >= -EXIT_DATE_MARGIN_DAYS &&
    daysBetween(termEnd, exitDate) <= EXIT_DATE_MARGIN_DAYS
  );
}

/** Assumption, see CLAUDE.md: a future date can be previewed, but only a real exit is saved. */
export const canSaveExit = (exitDate: IsoDate, today: IsoDate) => exitDate <= today;

export type RefundStep = "calculated" | "approved" | "paid";
export type RefundStage = "nothing-due" | "to-approve" | "to-pay" | "paid";

/** A ₹0 refund has nothing to approve or pay, so it never waits on anyone. */
export function refundStage(refund: Paise, status: RefundStep): RefundStage {
  if (refund === 0) return "nothing-due";
  if (status === "paid") return "paid";
  return status === "approved" ? "to-pay" : "to-approve";
}

type DeskRow = { refund: Paise; status: RefundStep; dueBy: IsoDate; paidOn: IsoDate | null };

/** The figures at the top of the refund desk. */
export function summariseRefunds(rows: DeskRow[], today: IsoDate) {
  const stages = rows.map((row) => refundStage(row.refund, row.status));
  const open = rows.filter((row) => row.refund > 0 && row.status !== "paid");
  const paid = rows.filter((row) => row.refund > 0 && row.paidOn);

  return {
    toApprove: stages.filter((stage) => stage === "to-approve").length,
    toPay: stages.filter((stage) => stage === "to-pay").length,
    overdue: open.filter((row) => row.dueBy < today).length,
    paid: paid.length,
    paidInTime: paid.filter((row) => row.paidOn! <= row.dueBy).length,
  };
}

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
