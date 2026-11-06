import type { IsoDate } from "./dates";
import { splitGst } from "./gst";
import type { Paise } from "./money";

export type TallyReceipt = {
  receiptNo: string | null;
  paidOn: IsoDate;
  centre: string;
  batch: string;
  studentCode: string;
  sequence: number;
  method: string;
  reference: string;
  amount: Paise;
  /** Amounts stay positive: the voucher type says which way the money went. */
  voucher?: "Receipt" | "Credit Note";
};

/**
 * Assumption, see docs/TDD.md: the brief names no format, so this is one row per receipt
 * voucher. These are field names for an import mapping, so they are not translated.
 * Student names are left out on purpose: the ID is enough to reconcile, and most are minors.
 */
const COLUMNS = [
  "Voucher Date",
  "Voucher Type",
  "Voucher Number",
  "Centre",
  "Batch",
  "Student ID",
  "Narration",
  "Debit Ledger",
  "Reference",
  "Course Fee",
  "CGST",
  "SGST",
  "Total",
];

const toRupees = (paise: Paise) => (paise / 100).toFixed(2);

/** Tally dates are day first. */
const toVoucherDate = (date: IsoDate) => date.split("-").reverse().join("-");

/** Stops a typed reference running as a formula when the file opens in a spreadsheet. */
export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

function voucherRow(receipt: TallyReceipt): string[] {
  const { taxable, cgst, sgst } = splitGst(receipt.amount);
  const voucher = receipt.voucher ?? "Receipt";

  return [
    toVoucherDate(receipt.paidOn),
    voucher,
    receipt.receiptNo ?? "",
    receipt.centre,
    receipt.batch,
    receipt.studentCode,
    voucher === "Receipt"
      ? `Instalment ${receipt.sequence}, ${receipt.studentCode}`
      : `Refund, ${receipt.studentCode}`,
    receipt.method === "cash" ? "Cash" : "Bank",
    receipt.reference,
    toRupees(taxable),
    toRupees(cgst),
    toRupees(sgst),
    toRupees(receipt.amount),
  ];
}

/** Starts with a byte order mark so spreadsheets read it as UTF-8. */
export function tallyCsv(receipts: TallyReceipt[]): string {
  const lines = [COLUMNS, ...receipts.map(voucherRow)].map((cells) =>
    cells.map(csvCell).join(","),
  );
  return `﻿${lines.join("\r\n")}\r\n`;
}

/** Month-end work looks back, so the form starts on the first of last month. */
export function defaultExportFrom(today: IsoDate): IsoDate {
  const [year, month] = today.split("-").map(Number);
  return month === 1 ? `${year - 1}-12-01` : `${year}-${String(month - 1).padStart(2, "0")}-01`;
}
