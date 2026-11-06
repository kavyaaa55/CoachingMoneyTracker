import { daysBetween, type IsoDate } from "./dates";
import type { Paise } from "./money";
import { parseCsv } from "./upload";

export const lastDayOf = (month: string): IsoDate => {
  const [year, number] = month.split("-").map(Number);
  return new Date(Date.UTC(year, number, 0)).toISOString().slice(0, 10);
};

/** Every month from one date to another, as YYYY-MM, newest first. */
export function monthsBetween(from: IsoDate, to: IsoDate): string[] {
  const months: string[] = [];
  let [year, month] = from.split("-").map(Number);
  for (;;) {
    const key = `${year}-${String(month).padStart(2, "0")}`;
    if (key > to.slice(0, 7)) break;
    months.unshift(key);
    month = month === 12 ? 1 : month + 1;
    if (month === 1) year += 1;
  }
  return months;
}

/** Days from the end of a month to the day it was closed. The brief wants this at 1. */
export const daysToClose = (month: string, closedOn: IsoDate) =>
  daysBetween(lastDayOf(month), closedOn);

/** Numbers missing from the receipt series. A rollback can skip one, and an auditor will ask. */
export function receiptGaps(receiptNumbers: string[]): number[] {
  const numbers = receiptNumbers
    .map((receipt) => Number(/^RCT-(\d+)$/.exec(receipt)?.[1]))
    .filter(Number.isInteger)
    .sort((a, b) => a - b);

  const missing: number[] = [];
  for (let index = 1; index < numbers.length; index += 1) {
    for (let gap = numbers[index - 1] + 1; gap < numbers[index]; gap += 1) missing.push(gap);
  }
  return missing;
}

export type VoucherTotals = { receipts: Paise; reversals: Paise; creditNotes: Paise };

const toPaise = (text: string) => Math.round(Number(text) * 100);

/**
 * Adds up the export file itself, from its fee, CGST and SGST columns. Reading the finished file
 * rather than the rows that built it means a rounding slip in the GST split would show up here.
 */
export function tallyFileTotals(csv: string): VoucherTotals {
  const [header = [], ...lines] = parseCsv(csv.replace(/^﻿/, ""));
  const column = (name: string) => header.indexOf(name);
  const totals: VoucherTotals = { receipts: 0, reversals: 0, creditNotes: 0 };

  for (const line of lines) {
    const amount =
      toPaise(line[column("Course Fee")]) +
      toPaise(line[column("CGST")]) +
      toPaise(line[column("SGST")]);
    const type = line[column("Voucher Type")];
    if (type === "Receipt") totals.receipts += amount;
    if (type === "Reversal") totals.reversals += amount;
    if (type === "Credit Note") totals.creditNotes += amount;
  }
  return totals;
}

export type QueueCandidate = {
  instalmentId: string;
  studentId: string;
  studentCode: string;
  studentName: string;
  sequence: number;
  balance: Paise;
  dueDate: IsoDate;
};

export type Suggestion = QueueCandidate & { reason: "exact-balance" | "same-student" };

const MAX_SUGGESTIONS = 3;

/**
 * Plain rules a person can check, and only ever suggestions: a person always confirms, so the
 * brief's rule that an unmatched payment marks nothing paid still holds. The claimed student comes
 * first, then anyone whose balance is exactly this amount. Nothing is offered if it would not fit.
 */
export function suggestMatches(
  amount: Paise,
  claimedStudentId: string | null,
  candidates: QueueCandidate[],
): Suggestion[] {
  const fits = candidates.filter((item) => amount <= item.balance);
  const sameStudent = fits
    .filter((item) => item.studentId === claimedStudentId)
    .map((item): Suggestion => ({ ...item, reason: "same-student" }));
  const exact = fits
    .filter((item) => item.balance === amount && item.studentId !== claimedStudentId)
    .map((item): Suggestion => ({ ...item, reason: "exact-balance" }));

  const byDueDate = (a: Suggestion, b: Suggestion) => a.dueDate.localeCompare(b.dueDate);
  return [...sameStudent.sort(byDueDate), ...exact.sort(byDueDate)].slice(0, MAX_SUGGESTIONS);
}
