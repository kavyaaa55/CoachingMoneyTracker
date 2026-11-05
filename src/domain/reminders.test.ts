import { describe, expect, it } from "vitest";
import { rupees } from "./money";
import { decideReminders, reminderSchedule, shouldPlan, stageOf } from "./reminders";

describe("reminderSchedule", () => {
  it("covers before, on and after the due date", () => {
    expect(reminderSchedule("2026-10-10")).toEqual([
      { dayOffset: -7, sendOn: "2026-10-03" },
      { dayOffset: -1, sendOn: "2026-10-09" },
      { dayOffset: 0, sendOn: "2026-10-10" },
      { dayOffset: 3, sendOn: "2026-10-13" },
      { dayOffset: 7, sendOn: "2026-10-17" },
    ]);
  });
});

describe("stageOf", () => {
  it("names each stage", () => {
    expect(stageOf(-7)).toBe("before");
    expect(stageOf(0)).toBe("on");
    expect(stageOf(3)).toBe("after");
  });
});

describe("shouldPlan", () => {
  it("plans up to 14 days ahead, and anything already past", () => {
    expect(shouldPlan("2026-11-15", "2026-11-02")).toBe(true);
    expect(shouldPlan("2026-11-16", "2026-11-02")).toBe(true);
    expect(shouldPlan("2026-11-17", "2026-11-02")).toBe(false);
    expect(shouldPlan("2026-10-10", "2026-11-02")).toBe(true);
  });
});

describe("decideReminders", () => {
  const one = { id: "a", dayOffset: -1 };
  const two = { id: "b", dayOffset: 0 };
  const three = { id: "c", dayOffset: 3 };

  it("sends the reminder that is due", () => {
    expect(decideReminders([one], rupees(100), false)).toEqual({ send: one, stop: [] });
  });

  it("stops everything once the balance is zero", () => {
    expect(decideReminders([one, two], 0, false)).toEqual({
      send: null,
      stop: [
        { id: "a", reason: "paid" },
        { id: "b", reason: "paid" },
      ],
    });
  });

  it("keeps sending while a balance is left after a part payment", () => {
    expect(decideReminders([one], 1, false).send).toBe(one);
  });

  it("sends only the latest stage after missed days", () => {
    expect(decideReminders([two, three, one], rupees(100), false)).toEqual({
      send: three,
      stop: [
        { id: "b", reason: "superseded" },
        { id: "a", reason: "superseded" },
      ],
    });
  });

  it("stops everything when the student has left", () => {
    expect(decideReminders([one], rupees(100), true)).toEqual({
      send: null,
      stop: [{ id: "a", reason: "student-left" }],
    });
  });

  it("does nothing when nothing is due", () => {
    expect(decideReminders([], rupees(100), false)).toEqual({ send: null, stop: [] });
  });
});
