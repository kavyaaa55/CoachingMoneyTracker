import { describe, expect, it } from "vitest";
import { addDays, daysBetween } from "./dates";

describe("dates", () => {
  it("counts days across months", () => {
    expect(daysBetween("2026-10-10", "2026-11-02")).toBe(23);
    expect(daysBetween("2026-11-15", "2026-11-02")).toBe(-13);
  });

  it("adds days across a year end", () => {
    expect(addDays("2026-12-28", 10)).toBe("2027-01-07");
  });

  it("rejects bad dates", () => {
    expect(() => daysBetween("10-10-2026", "2026-11-02")).toThrow("Invalid date");
  });
});
