import { describe, expect, it } from "vitest";
import {
  daysToClose,
  lastDayOf,
  monthsBetween,
  receiptGaps,
  suggestMatches,
  tallyFileTotals,
  type QueueCandidate,
} from "./books";
import { rupees } from "./money";
import { tallyCsv, type TallyReceipt } from "./tally";

const candidate = (code: string, balance: number, studentId = code, dueDate = "2026-10-10") =>
  ({
    instalmentId: `${code}-1`,
    studentId,
    studentCode: code,
    studentName: code,
    sequence: 1,
    balance: rupees(balance),
    dueDate,
  }) satisfies QueueCandidate;

describe("months", () => {
  it("finds the last day, including a leap February", () => {
    expect(lastDayOf("2026-09")).toBe("2026-09-30");
    expect(lastDayOf("2028-02")).toBe("2028-02-29");
  });

  it("lists months newest first, across a year end", () => {
    expect(monthsBetween("2026-11-20", "2027-01-02")).toEqual(["2027-01", "2026-12", "2026-11"]);
  });

  it("counts the days to close", () => {
    expect(daysToClose("2026-09", "2026-10-01")).toBe(1);
  });
});

describe("receiptGaps", () => {
  it("finds a number the series skipped", () => {
    expect(receiptGaps(["RCT-000001", "RCT-000004", "RCT-000002"])).toEqual([3]);
  });

  it("finds nothing in an unbroken series, and ignores anything else", () => {
    expect(receiptGaps(["RCT-000001", "RCT-000002", "other"])).toEqual([]);
  });
});

describe("tallyFileTotals", () => {
  const row: TallyReceipt = {
    receiptNo: "RCT-000001",
    paidOn: "2026-10-05",
    centre: "Centre 1",
    batch: "JEE, Evening",
    studentCode: "STU-1",
    sequence: 1,
    method: "upi",
    reference: "R",
    amount: rupees(15000),
  };

  it("adds each kind of voucher from the finished file", () => {
    const csv = tallyCsv([
      row,
      { ...row, amount: rupees(7500) },
      { ...row, voucher: "Reversal", amount: rupees(7500) },
      { ...row, voucher: "Credit Note", amount: rupees(1000) },
    ]);
    expect(tallyFileTotals(csv)).toEqual({
      receipts: rupees(22500),
      reversals: rupees(7500),
      creditNotes: rupees(1000),
    });
  });

  it("keeps every paisa through the GST split", () => {
    const awkward = 1234567;
    expect(tallyFileTotals(tallyCsv([{ ...row, amount: awkward }])).receipts).toBe(awkward);
  });
});

describe("suggestMatches", () => {
  it("offers a student whose balance is exactly this amount", () => {
    const [first] = suggestMatches(rupees(12500), null, [
      candidate("A", 30000),
      candidate("B", 12500),
    ]);
    expect(first).toMatchObject({ studentCode: "B", reason: "exact-balance" });
  });

  it("puts the claimed student first, on any instalment the money fits", () => {
    const list = suggestMatches(rupees(10000), "CLAIMED", [
      candidate("OTHER", 10000),
      candidate("MINE", 30000, "CLAIMED"),
    ]);
    expect(list.map((item) => item.reason)).toEqual(["same-student", "exact-balance"]);
  });

  it("offers nothing that would not fit, and no guesses", () => {
    expect(suggestMatches(rupees(35000), "A", [candidate("A", 30000, "A")])).toEqual([]);
    expect(suggestMatches(rupees(100), null, [candidate("A", 30000)])).toEqual([]);
  });

  it("shows at most three", () => {
    const many = ["A", "B", "C", "D"].map((code) => candidate(code, 100));
    expect(suggestMatches(rupees(100), null, many)).toHaveLength(3);
  });
});
