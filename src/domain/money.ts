/** All money is stored as whole paise, so sums never pick up rounding errors. */
export type Paise = number;

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
