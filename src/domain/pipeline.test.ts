import { describe, expect, it } from "vitest";
import { addCounts, emptyCounts, inDayOrder, type PipelineEvent } from "./pipeline";

describe("pipeline", () => {
  it("adds counts without losing any", () => {
    const total = addCounts(addCounts(emptyCounts(), { remindersSent: 2 }), { remindersSent: 1 });
    expect(total.remindersSent).toBe(3);
    expect(total.tasksCreated).toBe(0);
  });

  it("orders by date, then saves uploads before a student leaves", () => {
    const events: PipelineEvent[] = [
      { on: "2026-10-02", kind: "exit", code: "A" },
      { on: "2026-10-01", kind: "exit", code: "B" },
      { on: "2026-10-02", kind: "upload", centre: "C", batch: "D", file: "attendance", text: "" },
    ];
    expect(inDayOrder(events).map((event) => event.kind)).toEqual(["exit", "upload", "exit"]);
    expect(inDayOrder(events)[0].on).toBe("2026-10-01");
  });
});
