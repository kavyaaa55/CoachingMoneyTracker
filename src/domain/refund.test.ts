import { describe, expect, it } from "vitest";
import { rupees } from "./money";
import {
  calculateRefund,
  canSaveExit,
  isPlausibleExitDate,
  refundStage,
  summariseRefunds,
  type RefundStep,
} from "./refund";

const term = { termStart: "2026-07-01", termEnd: "2027-06-30" };
const ishita = { ...term, netFee: rupees(120000), paid: rupees(45000) };

describe("refund desk", () => {
  const row = (refund: number, status: RefundStep, dueBy: string, paidOn: string | null = null) => ({
    refund,
    status,
    dueBy,
    paidOn,
  });

  it("moves through its steps, and a ₹0 refund never waits on anyone", () => {
    expect(refundStage(100, "calculated")).toBe("to-approve");
    expect(refundStage(100, "approved")).toBe("to-pay");
    expect(refundStage(100, "paid")).toBe("paid");
    expect(refundStage(0, "calculated")).toBe("nothing-due");
  });

  it("counts what is waiting, what is late and what was paid in time", () => {
    const summary = summariseRefunds(
      [
        row(100, "calculated", "2026-11-06"),
        row(100, "calculated", "2026-10-30"),
        row(100, "approved", "2026-11-08"),
        row(100, "paid", "2026-10-04", "2026-09-30"),
        row(100, "paid", "2026-10-16", "2026-10-19"),
        row(0, "calculated", "2026-10-30"),
      ],
      "2026-11-02",
    );
    expect(summary).toEqual({ toApprove: 2, toPay: 1, overdue: 1, paid: 2, paidInTime: 1 });
  });
});

describe("calculateRefund", () => {
  it("works out Ishita leaving on 12 Oct 2026", () => {
    expect(calculateRefund({ ...ishita, exitDate: "2026-10-12" })).toEqual({
      termDays: 365,
      daysUsed: 104,
      feeUsed: rupees(34192),
      refund: rupees(10808),
      shortfall: 0,
      dueBy: "2026-10-22",
    });
  });

  it("uses the fee after discount", () => {
    const result = calculateRefund({ ...ishita, netFee: rupees(114000), exitDate: "2026-10-12" });
    expect(result.feeUsed).toBe(rupees(32482));
    expect(result.refund).toBe(rupees(12518));
  });

  it("never refunds below zero and reports the shortfall", () => {
    const result = calculateRefund({ ...ishita, paid: rupees(10000), exitDate: "2026-10-12" });
    expect(result.refund).toBe(0);
    expect(result.shortfall).toBe(rupees(24192));
  });

  it("charges one day on the first day of term", () => {
    expect(calculateRefund({ ...ishita, exitDate: "2026-07-01" }).daysUsed).toBe(1);
  });

  it("refunds everything when the student leaves before term starts", () => {
    const result = calculateRefund({ ...ishita, exitDate: "2026-06-20" });
    expect(result.daysUsed).toBe(0);
    expect(result.refund).toBe(rupees(45000));
  });

  it("charges the full fee after term ends", () => {
    const result = calculateRefund({ ...ishita, paid: rupees(120000), exitDate: "2027-08-01" });
    expect(result.daysUsed).toBe(365);
    expect(result.refund).toBe(0);
  });

  it("rejects a term that ends before it starts", () => {
    expect(() =>
      calculateRefund({ ...ishita, termEnd: "2026-01-01", exitDate: "2026-10-12" }),
    ).toThrow("Term must end after it starts");
  });
});

describe("isPlausibleExitDate", () => {
  const plausible = (date: string) => isPlausibleExitDate(date, term.termStart, term.termEnd);

  it("accepts dates in term and either side of it", () => {
    expect(plausible("2026-10-12")).toBe(true);
    expect(plausible("2026-06-20")).toBe(true);
    expect(plausible("2027-08-01")).toBe(true);
  });

  it("rejects a mistyped year", () => {
    expect(plausible("2006-10-12")).toBe(false);
    expect(plausible("9999-12-31")).toBe(false);
  });
});

describe("canSaveExit", () => {
  it("allows today and earlier, and refuses the future", () => {
    expect(canSaveExit("2026-11-01", "2026-11-02")).toBe(true);
    expect(canSaveExit("2026-11-02", "2026-11-02")).toBe(true);
    expect(canSaveExit("2026-11-03", "2026-11-02")).toBe(false);
  });
});
