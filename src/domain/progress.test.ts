import { describe, expect, it } from "vitest";
import { percentOf, recentAttendance } from "./progress";

const week = (weekStart: string, present: number, total = 6) => ({ weekStart, present, total });

describe("recentAttendance", () => {
  it("adds up the latest four weeks, whatever order they arrive in", () => {
    const weeks = [
      week("2026-10-05", 6),
      week("2026-10-26", 3),
      week("2026-09-28", 0),
      week("2026-10-19", 4),
      week("2026-10-12", 5),
    ];
    expect(recentAttendance(weeks)).toEqual({
      weeks: 4,
      present: 18,
      total: 24,
      percent: 75,
    });
  });

  it("works with fewer than four weeks", () => {
    expect(recentAttendance([week("2026-10-26", 4)])).toEqual({
      weeks: 1,
      present: 4,
      total: 6,
      percent: 67,
    });
  });

  it("has nothing to say without records", () => {
    expect(recentAttendance([])).toBeNull();
    expect(recentAttendance([week("2026-10-26", 0, 0)])).toBeNull();
  });
});

describe("percentOf", () => {
  it("rounds to a whole percentage", () => {
    expect(percentOf(180, 300)).toBe(60);
    expect(percentOf(1, 3)).toBe(33);
  });
});
