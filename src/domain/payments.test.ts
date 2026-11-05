import { describe, expect, it } from "vitest";
import { rupees } from "./money";
import { matchPayment } from "./payments";

describe("matchPayment", () => {
  it("matches the exact balance", () => {
    expect(matchPayment(rupees(15000), rupees(15000))).toEqual({
      status: "matched",
      partial: false,
    });
  });

  it("treats a smaller amount as a part payment", () => {
    expect(matchPayment(rupees(15000), rupees(5000))).toEqual({
      status: "matched",
      partial: true,
    });
  });

  it("sends any payment for a student who has left to the queue", () => {
    expect(matchPayment(rupees(15000), rupees(15000), true)).toEqual({
      status: "unmatched",
      reason: "student-left",
    });
  });

  it("sends a payment with no instalment to the queue", () => {
    expect(matchPayment(null, rupees(15000))).toEqual({
      status: "unmatched",
      reason: "no-instalment",
    });
  });

  it("sends an overpayment to the queue", () => {
    expect(matchPayment(rupees(15000), rupees(15001))).toEqual({
      status: "unmatched",
      reason: "amount-too-high",
    });
  });

  it("sends a payment on a fully paid instalment to the queue", () => {
    expect(matchPayment(0, rupees(100))).toEqual({
      status: "unmatched",
      reason: "amount-too-high",
    });
  });
});
