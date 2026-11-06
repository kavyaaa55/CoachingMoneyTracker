import { describe, expect, it } from "vitest";
import { buildSampleData, SAMPLE_TODAY } from "@/db/sample-data";
import { addDays } from "./dates";
import {
  assessRisk,
  latestWeekByBatch,
  decideTask,
  falseFlagRate,
  REFLAG_AFTER_DAYS,
  type AttendanceWeek,
  type RiskInput,
  type TestScore,
} from "./risk";

const TODAY = "2026-11-02";

/** Eight earlier weeks at one level, then four recent weeks at another, out of 10 classes. */
const weeks = (earlier: number, recent: number): AttendanceWeek[] =>
  Array.from({ length: 12 }, (_, index) => ({
    weekStart: addDays("2026-08-10", index * 7),
    present: index < 8 ? earlier : recent,
    total: 10,
  }));

/** Four earlier tests at one percentage, then two recent ones at another. */
const tests = (earlier: number, recent: number): TestScore[] =>
  Array.from({ length: 6 }, (_, index) => ({
    takenOn: addDays("2026-07-25", index * 18),
    score: index < 4 ? earlier : recent,
    maxScore: 100,
  }));

const paid = { dueDate: "2026-07-10", amount: 3000000, paid: 3000000 };
const late = { dueDate: "2026-10-10", amount: 3000000, paid: 1500000 };
const notDue = { dueDate: "2027-01-10", amount: 3000000, paid: 0 };

const input = (changes: Partial<RiskInput> = {}): RiskInput => ({
  instalments: [paid, notDue],
  attendance: weeks(9, 9),
  scores: tests(70, 70),
  today: TODAY,
  ...changes,
});

describe("assessRisk bands", () => {
  it("is none when everything is steady", () => {
    expect(assessRisk(input())).toEqual({ band: "none", reasons: [] });
  });

  it("is none for late fees alone, however many, like Ishita", () => {
    expect(assessRisk(input({ instalments: [late, notDue] })).band).toBe("none");
    expect(assessRisk(input({ instalments: [late, { ...late, dueDate: "2026-09-01" }] })).band).toBe(
      "none",
    );
  });

  it("is none for one mild academic sign on its own", () => {
    expect(assessRisk(input({ scores: tests(70, 58) })).band).toBe("none");
    expect(assessRisk(input({ attendance: weeks(9, 7) })).band).toBe("none");
  });

  it("is watch for one strong academic sign", () => {
    const result = assessRisk(input({ attendance: weeks(9, 5) }));
    expect(result).toEqual({
      band: "watch",
      reasons: [{ kind: "attendance", from: 90, to: 50 }],
    });
  });

  it("is watch for a mild sign plus a late fee, and gives both reasons", () => {
    const result = assessRisk(input({ instalments: [late], scores: tests(70, 58) }));
    expect(result).toEqual({
      band: "watch",
      reasons: [
        { kind: "tests", from: 70, to: 58 },
        { kind: "missed", count: 1 },
      ],
    });
  });

  it("is high when attendance and tests both fall sharply", () => {
    const result = assessRisk(input({ attendance: weeks(9, 5), scores: tests(70, 45) }));
    expect(result.band).toBe("high");
    expect(result.reasons.map((reason) => reason.kind)).toEqual(["attendance", "tests"]);
  });

  it("is high for one strong sign plus two missed instalments", () => {
    const result = assessRisk(
      input({
        attendance: weeks(9, 5),
        instalments: [late, { ...late, dueDate: "2026-09-01" }],
      }),
    );
    expect(result.band).toBe("high");
    expect(result.reasons).toContainEqual({ kind: "missed", count: 2 });
  });

  it("puts the thresholds exactly at the edges", () => {
    expect(assessRisk(input({ attendance: weeks(9, 6) })).band).toBe("watch");
    expect(assessRisk(input({ scores: tests(70, 50) })).band).toBe("watch");
    expect(assessRisk(input({ scores: tests(70, 51) })).band).toBe("none");
  });

  it("ignores rising trends", () => {
    expect(assessRisk(input({ attendance: weeks(5, 9), scores: tests(40, 80) })).band).toBe("none");
  });

  it("does not count an instalment due today or later as missed", () => {
    const dueToday = { dueDate: TODAY, amount: 3000000, paid: 0 };
    const result = assessRisk(input({ instalments: [dueToday], attendance: weeks(9, 5) }));
    expect(result.reasons.some((reason) => reason.kind === "missed")).toBe(false);
  });

  it("does not depend on the order of the records", () => {
    const shuffled = assessRisk(
      input({ attendance: weeks(9, 5).reverse(), scores: tests(70, 45).reverse() }),
    );
    expect(shuffled.band).toBe("high");
  });
});

describe("assessRisk with missing data", () => {
  const thin = { band: "not-enough-data", reasons: [] };

  it("says so with too few weeks of attendance, even with a late fee", () => {
    expect(assessRisk(input({ instalments: [late], attendance: weeks(9, 2).slice(0, 5) }))).toEqual(
      thin,
    );
  });

  it("says so with too few tests", () => {
    expect(assessRisk(input({ scores: tests(70, 20).slice(0, 3) }))).toEqual(thin);
  });

  it("says so with no records at all", () => {
    expect(assessRisk(input({ attendance: [], scores: [] }))).toEqual(thin);
    expect(assessRisk(input({ instalments: [] }))).toEqual(thin);
  });

  it("works with exactly the minimum", () => {
    expect(assessRisk(input({ attendance: weeks(9, 9).slice(0, 6), scores: tests(70, 70).slice(0, 4) })).band).toBe("none");
  });

  it("does not count weeks or tests with nothing held", () => {
    const empty = weeks(9, 9).map((week) => ({ ...week, present: 0, total: 0 }));
    const noMarks = tests(70, 70).map((test) => ({ ...test, score: 0, maxScore: 0 }));

    expect(assessRisk(input({ attendance: empty })).band).toBe("not-enough-data");
    expect(assessRisk(input({ scores: noMarks })).band).toBe("not-enough-data");
  });
});

describe("records that stop", () => {
  const steadyWeeks = Array.from({ length: 8 }, (_, index) => ({
    weekStart: addDays("2026-08-10", index * 7),
    present: 6,
    total: 6,
  }));
  const steadyTests = Array.from({ length: 4 }, (_, index) => ({
    takenOn: addDays("2026-07-25", index * 18),
    score: 200,
    maxScore: 300,
  }));
  const base = {
    instalments: [{ dueDate: "2026-07-10", amount: 100, paid: 100 }],
    attendance: steadyWeeks,
    scores: steadyTests,
    today: "2026-11-02",
  };

  it("flags a student two weeks behind the rest of the batch", () => {
    expect(assessRisk({ ...base, batchLatestWeek: "2026-10-12" })).toEqual({
      band: "watch",
      reasons: [{ kind: "missing", weeks: 2 }],
    });
  });

  it("leaves one late week alone", () => {
    expect(assessRisk({ ...base, batchLatestWeek: "2026-10-05" }).band).toBe("none");
  });

  it("does not flag anyone when the whole batch's file is late", () => {
    expect(assessRisk({ ...base, batchLatestWeek: "2026-09-28" }).band).toBe("none");
  });

  it("finds the latest week in each batch", () => {
    const latest = latestWeekByBatch([
      { batchId: "a", weekStart: "2026-10-05" },
      { batchId: "a", weekStart: "2026-10-26" },
      { batchId: "b", weekStart: "2026-09-28" },
    ]);
    expect(latest.get("a")).toBe("2026-10-26");
    expect(latest.get("b")).toBe("2026-09-28");
  });
});

describe("assessRisk on the sample data", () => {
  const { students } = buildSampleData();
  const results = students.filter((student) => !student.exit).map((student) => ({
    code: student.code,
    ...assessRisk({ ...student, today: SAMPLE_TODAY }),
  }));
  const band = (code: string) => results.find((item) => item.code === code)?.band;

  it("flags exactly the three students built to trigger it", () => {
    const flagged = results.filter((item) => item.band === "watch" || item.band === "high");
    expect(flagged.map((item) => item.code).sort()).toEqual(["STU-1037", "STU-1038", "STU-1039"]);
  });

  it("does not flag Ishita for her late fee", () => {
    expect(band("STU-0587")).toBe("none");
  });

  it("says Manav has too little data, and nobody else", () => {
    const thin = results.filter((item) => item.band === "not-enough-data");
    expect(thin.map((item) => item.code)).toEqual(["STU-1040"]);
  });
});

describe("decideTask", () => {
  const flagged = { band: "high" as const, reasons: [] };
  const fresh = { hasOpenTask: false, lastReviewedOn: null };

  it("creates a task for a new flag", () => {
    expect(decideTask(flagged, fresh, TODAY)).toBe("create");
    expect(decideTask({ band: "watch", reasons: [] }, fresh, TODAY)).toBe("create");
  });

  it("creates nothing for none or not enough data", () => {
    expect(decideTask({ band: "none", reasons: [] }, fresh, TODAY)).toBe("skip");
    expect(decideTask({ band: "not-enough-data", reasons: [] }, fresh, TODAY)).toBe("skip");
  });

  it("refreshes an open task instead of adding another", () => {
    expect(decideTask(flagged, { hasOpenTask: true, lastReviewedOn: null }, TODAY)).toBe("update");
  });

  it("leaves a reviewed student alone, then allows a new task", () => {
    const reviewed = (days: number) => ({
      hasOpenTask: false,
      lastReviewedOn: addDays(TODAY, -days),
    });

    expect(decideTask(flagged, reviewed(0), TODAY)).toBe("skip");
    expect(decideTask(flagged, reviewed(REFLAG_AFTER_DAYS - 1), TODAY)).toBe("skip");
    expect(decideTask(flagged, reviewed(REFLAG_AFTER_DAYS), TODAY)).toBe("create");
  });
});

describe("falseFlagRate", () => {
  it("is empty until something is reviewed", () => {
    expect(falseFlagRate(0, 0)).toBeNull();
  });

  it("is the share of reviewed flags that were wrong", () => {
    expect(falseFlagRate(3, 1)).toBe(25);
    expect(falseFlagRate(0, 2)).toBe(100);
    expect(falseFlagRate(2, 0)).toBe(0);
    expect(falseFlagRate(2, 1)).toBe(33);
  });
});
