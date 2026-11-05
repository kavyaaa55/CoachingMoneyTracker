import type { Paise } from "./money";

export type UnmatchedReason = "no-instalment" | "amount-too-high";

export type MatchResult =
  | { status: "matched"; partial: boolean }
  | { status: "unmatched"; reason: UnmatchedReason };

/**
 * Assumption, see CLAUDE.md: anything up to the balance is applied to the instalment.
 * Anything else goes to the accounts queue and marks nothing paid.
 */
export function matchPayment(instalmentBalance: Paise | null, amount: Paise): MatchResult {
  if (instalmentBalance === null) return { status: "unmatched", reason: "no-instalment" };
  if (amount > instalmentBalance) return { status: "unmatched", reason: "amount-too-high" };
  return { status: "matched", partial: amount < instalmentBalance };
}
