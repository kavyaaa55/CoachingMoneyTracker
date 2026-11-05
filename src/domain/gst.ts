import type { Paise } from "./money";

/** Assumptions, see CLAUDE.md. The brief says receipts show GST but gives no rate or GSTIN. */
export const GST_RATE_PERCENT = 18;
export const SAMPLE_GSTIN = "08XXXXX0000X1Z0";

/** Splits a GST-inclusive amount. The three parts always add up to the total exactly. */
export function splitGst(total: Paise) {
  const taxable = Math.round((total * 100) / (100 + GST_RATE_PERCENT));
  const tax = total - taxable;
  const cgst = Math.floor(tax / 2);

  return { taxable, cgst, sgst: tax - cgst };
}
