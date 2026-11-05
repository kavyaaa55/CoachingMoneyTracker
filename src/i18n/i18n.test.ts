import { describe, expect, it } from "vitest";
import {
  formatDate,
  messages,
  reminderMessage,
  riskReasonLabel,
  stageLabel,
  statusLabel,
} from "./index";

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

describe("reminderMessage", () => {
  const details = {
    studentName: "Ishita Sharma",
    amount: 1500000,
    dueDate: "2026-10-10",
    link: "https://example.test/pay",
  };

  it("has the amount and pay link at every stage, in both languages", () => {
    for (const locale of ["en", "hi"] as const) {
      for (const dayOffset of [-7, -1, 0, 3, 7]) {
        const text = reminderMessage(locale, { ...details, dayOffset });
        expect(text).toContain("₹15,000");
        expect(text).toContain("Ishita Sharma");
        expect(text).toContain(details.link);
      }
    }
  });

  it("changes tense with the stage", () => {
    expect(reminderMessage("en", { ...details, dayOffset: -1 })).toContain("is due on 10 Oct 2026");
    expect(reminderMessage("en", { ...details, dayOffset: 0 })).toContain("is due today");
    expect(reminderMessage("en", { ...details, dayOffset: 3 })).toContain("was due on 10 Oct 2026");
    expect(reminderMessage("hi", { ...details, dayOffset: 3 })).toContain("देय थी");
  });
});

describe("riskReasonLabel", () => {
  it("words each reason in plain language", () => {
    expect(riskReasonLabel({ kind: "missed", count: 1 }, en)).toBe("1 instalment overdue");
    expect(riskReasonLabel({ kind: "missed", count: 2 }, en)).toBe("2 instalments overdue");
    expect(riskReasonLabel({ kind: "attendance", from: 83, to: 42 }, en)).toBe(
      "Attendance fell from 83% to 42%",
    );
    expect(riskReasonLabel({ kind: "tests", from: 60, to: 35 }, hi)).toContain("35%");
  });
});

describe("stageLabel", () => {
  it("names each stage", () => {
    expect(stageLabel(-7, en)).toBe("7 days before");
    expect(stageLabel(-1, en)).toBe("1 day before");
    expect(stageLabel(0, en)).toBe("On the due date");
    expect(stageLabel(3, en)).toBe("3 days after");
  });
});
