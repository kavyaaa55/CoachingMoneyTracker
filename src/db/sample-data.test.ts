import { describe, expect, it } from "vitest";
import { balanceOf, instalmentStatus } from "@/domain/instalments";
import { reminderSchedule } from "@/domain/reminders";
import { buildSampleData, CENTRES, PLAN_TOTAL, SAMPLE_TODAY } from "./sample-data";

const { students, unmatchedPayments } = buildSampleData();
const byCode = (code: string) => students.find((student) => student.code === code)!;

function overdueDays() {
  return students.flatMap((student) =>
    student.instalments.flatMap((instalment) => {
      const status = instalmentStatus(instalment, SAMPLE_TODAY);
      return status.kind === "overdue" ? [status.days] : [];
    }),
  );
}

describe("sample data", () => {
  it("is identical on every run", () => {
    expect(buildSampleData()).toEqual(buildSampleData());
  });

  it("keeps the three rows from the brief exactly", () => {
    expect(byCode("STU-0412").instalments[1]).toMatchObject({
      dueDate: "2026-10-10",
      amount: 30000,
      paid: 30000,
    });
    expect(byCode("STU-0587").instalments[1]).toMatchObject({
      dueDate: "2026-10-10",
      amount: 30000,
      paid: 15000,
    });
    expect(byCode("STU-0219").instalments[1]).toMatchObject({
      dueDate: "2026-11-15",
      amount: 40000,
      paid: 0,
    });
  });

  it("has unique codes and names", () => {
    expect(students).toHaveLength(60);
    expect(new Set(students.map((student) => student.code)).size).toBe(60);
    expect(new Set(students.map((student) => student.name)).size).toBe(60);
  });

  it("covers all four centres", () => {
    expect(new Set(students.map((student) => student.centre))).toEqual(new Set(CENTRES));
  });

  it("has money in every ageing bucket", () => {
    const days = overdueDays();
    expect(days.filter((day) => day <= 30).length).toBeGreaterThanOrEqual(3);
    expect(days.filter((day) => day > 30 && day <= 60).length).toBeGreaterThanOrEqual(3);
    expect(days.filter((day) => day > 60).length).toBeGreaterThanOrEqual(3);
  });

  it("has overdue students in every centre and in both JEE and NEET", () => {
    const owing = students.filter((student) =>
      student.instalments.some(
        (item) => instalmentStatus(item, SAMPLE_TODAY).kind === "overdue",
      ),
    );
    expect(new Set(owing.map((student) => student.centre))).toEqual(new Set(CENTRES));
    expect(owing.some((student) => student.batch.startsWith("JEE"))).toBe(true);
    expect(owing.some((student) => student.batch.startsWith("NEET"))).toBe(true);
  });

  it("makes instalments add up to the fee after discount", () => {
    for (const student of students) {
      const total = student.instalments.reduce((sum, item) => sum + item.amount, 0);
      expect(total).toBe(PLAN_TOTAL - student.discount);
      expect(student.instalments.every((item) => Number.isInteger(item.amount))).toBe(true);
    }
  });

  it("includes discounts, part payments and fully paid students", () => {
    expect(students.some((student) => student.discount > 0)).toBe(true);
    expect(
      students.some((s) => s.instalments.some((i) => i.paid > 0 && balanceOf(i) > 0)),
    ).toBe(true);
    expect(students.some((s) => s.instalments.every((i) => balanceOf(i) === 0))).toBe(true);
  });

  it("never records a payment dated after today", () => {
    for (const { instalments } of students) {
      for (const { paidOn } of instalments) {
        if (paidOn) expect(paidOn <= SAMPLE_TODAY).toBe(true);
      }
    }
  });

  it("has a parent with two children", () => {
    const phones = students.map((student) => student.parentPhone);
    expect(new Set(phones).size).toBe(phones.length - 1);
  });

  it("has three students with falling attendance and scores", () => {
    const falling = students.filter(({ attendance, scores, exit }) => {
      if (exit || attendance.length < 12 || scores.length < 6) return false;
      return attendance[11].present <= 2 && scores[5].score < scores[0].score - 80;
    });
    expect(falling).toHaveLength(3);
  });

  it("has one student with too little data", () => {
    const thin = students.filter((student) => student.scores.length === 0);
    expect(thin).toHaveLength(1);
    expect(thin[0].attendance).toHaveLength(1);
  });

  it("has a reminder stage for every kind on the demo date", () => {
    const offsets = students.flatMap((student) =>
      student.instalments
        .filter((item) => balanceOf(item) > 0)
        .flatMap((item) => reminderSchedule(item.dueDate, SAMPLE_TODAY))
        .filter((stage) => stage.sendOn === SAMPLE_TODAY)
        .map((stage) => stage.dayOffset),
    );
    expect([...new Set(offsets)]).toEqual(expect.arrayContaining([-7, -1, 0, 3, 7]));
  });

  it("has a queued payment for each reason the matching rules can give", () => {
    expect(unmatchedPayments).toHaveLength(3);
  });

  it("only pays leavers before they left, so nothing is refused on replay", () => {
    for (const { exit, instalments } of students) {
      if (exit) expect(instalments.every((i) => !i.paidOn || i.paidOn <= exit.on)).toBe(true);
    }
  });
});
