import { describe, expect, it } from "vitest";
import { rupees } from "./money";
import { lateShare, lateShareByCentre, lateShareByMonth, paidAfterReminder } from "./scoreboard";

const TODAY = "2026-11-02";

const instalment = (dueDate: string, payments: [number, string][], centre = "Centre 1") => ({
  dueDate,
  amount: rupees(30000),
  centre,
  payments: payments.map(([amount, paidOn]) => ({ amount: rupees(amount), paidOn })),
});

describe("lateShare", () => {
  it("counts nothing late when paid inside 60 days", () => {
    expect(lateShare([instalment("2026-07-10", [[30000, "2026-09-08"]])], TODAY).percent).toBe(0);
  });

  it("counts a payment on day 61 as late", () => {
    expect(lateShare([instalment("2026-07-10", [[30000, "2026-09-09"]])], TODAY).percent).toBe(100);
  });

  it("counts money still unpaid after 60 days as late", () => {
    expect(lateShare([instalment("2026-07-10", [])], TODAY).percent).toBe(100);
  });

  it("works per rupee, so a part payment counts only for what was late", () => {
    const result = lateShare(
      [
        instalment("2026-07-10", [
          [15000, "2026-07-10"],
          [15000, "2026-10-01"],
        ]),
      ],
      TODAY,
    );
    expect(result).toEqual({ measured: rupees(30000), late: rupees(15000), percent: 50 });
  });

  it("leaves out instalments too new to be 60 days late, which would flatter the figure", () => {
    const result = lateShare(
      [instalment("2026-07-10", []), instalment("2026-10-10", [[30000, "2026-10-10"]])],
      TODAY,
    );
    expect(result.measured).toBe(rupees(30000));
    expect(result.percent).toBe(100);
  });

  it("has no figure until something can be measured", () => {
    expect(lateShare([instalment("2026-10-10", [])], TODAY).percent).toBeNull();
  });

  it("uses one decimal, so a small change is visible", () => {
    const rows = Array.from({ length: 7 }, () => instalment("2026-07-10", [[30000, "2026-07-10"]]));
    expect(lateShare([...rows, instalment("2026-07-10", [])], TODAY).percent).toBe(12.5);
  });
});

describe("lateShare groups", () => {
  const rows = [
    instalment("2026-07-10", [], "Centre 2"),
    instalment("2026-07-15", [[30000, "2026-07-15"]], "Centre 1"),
    instalment("2026-08-10", [[30000, "2026-08-10"]], "Centre 1"),
    instalment("2026-10-10", [], "Centre 1"),
  ];

  it("groups by due month and leaves out months not yet measurable", () => {
    expect(lateShareByMonth(rows, TODAY).map(({ key, percent }) => [key, percent])).toEqual([
      ["2026-07", 50],
      ["2026-08", 0],
    ]);
  });

  it("groups by centre", () => {
    expect(lateShareByCentre(rows, TODAY).map(({ key, percent }) => [key, percent])).toEqual([
      ["Centre 1", 0],
      ["Centre 2", 100],
    ]);
  });
});

describe("paidAfterReminder", () => {
  it("counts a payment within 3 days of a reminder for the same instalment", () => {
    expect(
      paidAfterReminder(
        [
          { instalmentId: "a", sentOn: "2026-10-01" },
          { instalmentId: "b", sentOn: "2026-10-01" },
          { instalmentId: "c", sentOn: "2026-10-01" },
          { instalmentId: "d", sentOn: "2026-10-01" },
        ],
        [
          { instalmentId: "a", paidOn: "2026-10-04" },
          { instalmentId: "b", paidOn: "2026-10-05" },
          { instalmentId: "c", paidOn: "2026-09-30" },
          { instalmentId: "x", paidOn: "2026-10-01" },
        ],
      ),
    ).toEqual({ sent: 4, followed: 1 });
  });
});
