/** All money is stored as whole paise, so sums never pick up rounding errors. */
export type Paise = number;

/** No single payment is near this. It keeps typing mistakes out of the ledger. */
const MAX_AMOUNT = 100_00_000_00;

export const rupees = (amount: number): Paise => Math.round(amount * 100);

/** Formats paise in Indian grouping, for example 12000000 becomes ₹1,20,000. */
export function formatInr(paise: Paise): string {
  const hasPaise = paise % 100 !== 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: hasPaise ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(paise / 100);
}

/** Reads an amount typed in rupees, such as 15,000 or 15000.50. Returns null if invalid. */
export function parseRupees(input: string): Paise | null {
  const cleaned = input.replace(/[,\s₹]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;

  const paise = rupees(Number(cleaned));
  return paise > 0 && paise <= MAX_AMOUNT ? paise : null;
}
