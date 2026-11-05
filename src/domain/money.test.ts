import { describe, expect, it } from "vitest";
import { formatInr, parseRupees, rupees } from "./money";

describe("formatInr", () => {
  it("uses Indian grouping", () => {
    expect(formatInr(rupees(120000))).toBe("₹1,20,000");
    expect(formatInr(rupees(31200000))).toBe("₹3,12,00,000");
  });

  it("shows zero and small amounts", () => {
    expect(formatInr(0)).toBe("₹0");
    expect(formatInr(rupees(15000))).toBe("₹15,000");
  });

  it("keeps paise only when there are some", () => {
    expect(formatInr(1050)).toBe("₹10.50");
  });
});

describe("parseRupees", () => {
  it("reads common ways of typing an amount", () => {
    expect(parseRupees("15000")).toBe(rupees(15000));
    expect(parseRupees("15,000")).toBe(rupees(15000));
    expect(parseRupees("₹ 1,20,000")).toBe(rupees(120000));
    expect(parseRupees("100.29")).toBe(10029);
  });

  it("rejects anything that is not a positive amount", () => {
    for (const value of ["", "0", "0.00", "-5", "abc", "12.345", "1e5"]) {
      expect(parseRupees(value)).toBeNull();
    }
  });

  it("rejects an amount far beyond any fee", () => {
    expect(parseRupees("999999999")).toBeNull();
  });
});
