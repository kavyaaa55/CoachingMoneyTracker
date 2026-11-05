import { describe, expect, it } from "vitest";
import { formatInr, rupees } from "./money";

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
