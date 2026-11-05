import { describe, expect, it } from "vitest";
import { formatDate, messages, statusLabel } from "./index";

const en = messages("en");
const hi = messages("hi");

describe("statusLabel", () => {
  it("matches the wording in the brief", () => {
    expect(statusLabel({ kind: "paid" }, en)).toBe("Paid");
    expect(statusLabel({ kind: "overdue", days: 23, partPaid: true }, en)).toBe(
      "Part paid, 23 days overdue",
    );
    expect(statusLabel({ kind: "due", days: 13, partPaid: false }, en)).toBe("Due in 13 days");
  });

  it("handles one day and the due date itself", () => {
    expect(statusLabel({ kind: "overdue", days: 1, partPaid: false }, en)).toBe("1 day overdue");
    expect(statusLabel({ kind: "due", days: 0, partPaid: false }, en)).toBe("Due today");
  });

  it("has Hindi wording", () => {
    expect(statusLabel({ kind: "overdue", days: 23, partPaid: false }, hi)).toBe("23 दिन की देरी");
  });
});

describe("formatDate", () => {
  it("formats in both languages without shifting the day", () => {
    expect(formatDate("2026-10-10", "en")).toBe("10 Oct 2026");
    expect(formatDate("2026-10-10", "hi")).toMatch(/^10 \S+ 2026$/);
    expect(formatDate("2026-10-10", "hi")).not.toContain("॰");
  });
});
