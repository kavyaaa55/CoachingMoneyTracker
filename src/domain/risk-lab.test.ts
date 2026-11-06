import { describe, expect, it } from "vitest";
import { addDays } from "./dates";
import {
  compareReplays,
  falseFlagsByReason,
  knownOn,
  readRules,
  replayRule,
  summariseReplay,
  type LabStudent,
} from "./risk-lab";
import { DEFAULT_RULES } from "./risk";

const TERM_START = "2026-07-01";
const TODAY = "2026-11-02";

const student = (
  code: string,
  shape: "fading" | "steady",
  exitDate: string | null = null,
  latePayment = false,
): LabStudent => ({
  code,
  name: code,
  batchId: "batch",
  exitDate,
  instalments: [
    {
      dueDate: "2026-07-10",
      amount: 100,
      payments: [{ amount: 100, paidOn: latePayment ? "2026-10-25" : "2026-07-10" }],
    },
  ],
  attendance: Array.from({ length: 12 }, (_, index) => ({
    weekStart: addDays("2026-08-10", index * 7),
    present: shape === "fading" ? Math.max(0, 6 - Math.floor(index / 2)) : 6,
    total: 6,
  })),
  scores: Array.from({ length: 6 }, (_, index) => ({
    takenOn: addDays("2026-07-25", index * 18),
    score: shape === "fading" ? 240 - index * 30 : 200,
    maxScore: 300,
  })),
});

describe("knownOn", () => {
  it("uses only payments made by that day, so a replay cannot see the future", () => {
    const known = knownOn(student("A", "steady", null, true), "2026-09-01");
    expect(known.instalments[0].paid).toBe(0);
    expect(knownOn(student("A", "steady", null, true), "2026-10-25").instalments[0].paid).toBe(100);
  });

  it("knows a week's attendance only once its file is sent on the Sunday", () => {
    const { attendance } = student("A", "steady");
    expect(knownOn({ ...student("A", "steady") }, "2026-08-15").attendance).toHaveLength(0);
    expect(knownOn({ ...student("A", "steady") }, "2026-08-16").attendance).toEqual([attendance[0]]);
  });

  it("knows a test's marks only from the day after", () => {
    expect(knownOn(student("A", "steady"), "2026-07-25").scores).toHaveLength(0);
    expect(knownOn(student("A", "steady"), "2026-07-26").scores).toHaveLength(1);
  });
});

describe("replayRule", () => {
  const rows = replayRule(
    [
      student("LEFT-FADING", "fading", "2026-10-27"),
      student("LEFT-STEADY", "steady", "2026-10-27"),
      student("HERE-FADING", "fading"),
      student("HERE-STEADY", "steady"),
    ],
    TERM_START,
    TODAY,
  );
  const row = (code: string) => rows.find((item) => item.code === code);

  it("finds a leaver it flagged in time, and how early", () => {
    expect(row("LEFT-FADING")?.outcome).toBe("caught");
    expect(row("LEFT-FADING")?.warningDays).toBeGreaterThan(0);
  });

  it("is honest about a leaver it missed", () => {
    expect(row("LEFT-STEADY")).toMatchObject({ outcome: "missed", firstFlag: null });
  });

  it("shows a flagged student still enrolled, and leaves out steady ones", () => {
    expect(row("HERE-FADING")?.outcome).toBe("open");
    expect(row("HERE-STEADY")).toBeUndefined();
  });

  it("summarises the result", () => {
    expect(summariseReplay(rows)).toMatchObject({ left: 2, caught: 1, open: 1 });
    expect(summariseReplay([]).averageWarning).toBeNull();
  });

  it("never flags a student for late fees alone, however low the numbers go", () => {
    const debtor: LabStudent = {
      ...student("DEBT", "steady"),
      instalments: [
        { dueDate: "2026-07-10", amount: 100, payments: [] },
        { dueDate: "2026-08-10", amount: 100, payments: [] },
        { dueDate: "2026-09-10", amount: 100, payments: [] },
      ],
    };
    const loosest = { ...DEFAULT_RULES, watchPoints: 1, highPoints: 2 };
    expect(replayRule([debtor], TERM_START, TODAY, loosest)).toEqual([]);
  });
});

describe("compareReplays", () => {
  it("says who a change would add and drop", () => {
    const flaggedRow = (code: string) => ({
      code,
      name: code,
      firstFlag: "2026-10-01",
      exitDate: null,
      warningDays: null,
      outcome: "open" as const,
    });
    expect(
      compareReplays([flaggedRow("A"), flaggedRow("B")], [flaggedRow("B"), flaggedRow("C")]),
    ).toEqual({ added: ["C"], dropped: ["A"] });
  });
});

describe("falseFlagsByReason", () => {
  it("counts reviewed flags per reason and ignores open ones", () => {
    const attendance = { kind: "attendance" as const, from: 90, to: 50 };
    const missed = { kind: "missed" as const, count: 1 };
    expect(
      falseFlagsByReason([
        { status: "false_flag", reasons: [attendance, missed] },
        { status: "called", reasons: [attendance] },
        { status: "open", reasons: [missed] },
      ]),
    ).toEqual([
      { kind: "attendance", reviewed: 2, falseFlags: 1 },
      { kind: "missed", reviewed: 1, falseFlags: 1 },
    ]);
  });
});

describe("readRules", () => {
  it("uses the live rule when nothing is given", () => {
    expect(readRules({})).toEqual({ rules: DEFAULT_RULES, invalid: false });
  });

  it("reads new numbers", () => {
    expect(readRules({ am: "10", w: "1" }).rules).toMatchObject({
      attendanceDrop: { mild: 10, strong: 30 },
      watchPoints: 1,
    });
  });

  it("falls back to the live rule on nonsense or numbers the wrong way round", () => {
    expect(readRules({ am: "abc" })).toEqual({ rules: DEFAULT_RULES, invalid: true });
    expect(readRules({ am: "40" })).toEqual({ rules: DEFAULT_RULES, invalid: true });
    expect(readRules({ h: "1" })).toEqual({ rules: DEFAULT_RULES, invalid: true });
    expect(readRules({ w: "0" })).toEqual({ rules: DEFAULT_RULES, invalid: true });
  });
});
