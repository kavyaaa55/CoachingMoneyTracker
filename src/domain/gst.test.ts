import { describe, expect, it } from "vitest";
import { splitGst } from "./gst";
import { rupees } from "./money";

describe("splitGst", () => {
  it("takes 18% out of an inclusive amount", () => {
    expect(splitGst(rupees(118))).toEqual({
      taxable: rupees(100),
      cgst: rupees(9),
      sgst: rupees(9),
    });
  });

  it("splits a sample payment", () => {
    expect(splitGst(rupees(15000))).toEqual({ taxable: 1271186, cgst: 114407, sgst: 114407 });
  });

  it("always adds back to the total", () => {
    for (const total of [1, 99, 3333, 1500001, 12000000]) {
      const { taxable, cgst, sgst } = splitGst(total);
      expect(taxable + cgst + sgst).toBe(total);
    }
  });
});
