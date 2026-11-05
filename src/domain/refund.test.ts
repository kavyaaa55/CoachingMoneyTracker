import { describe, expect, it } from "vitest";
import { rupees } from "./money";
import { calculateRefund } from "./refund";

const term = { termStart: "2026-07-01", termEnd: "2027-06-30" };
const ishita = { ...term, netFee: rupees(120000), paid: rupees(45000) };

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
