import { describe, expect, it } from "vitest";
import { ageingBucket, duesByBatch, summariseDues, type BatchInstalment } from "./dues";
import { rupees } from "./money";

const TODAY = "2026-11-02";

const row = (
  studentId: string,
  dueDate: string,
  amount: number,
  paid: number,
  batch = "JEE 2027 Morning",
  centre = "Centre 1",
): BatchInstalment => ({
  studentId,
  dueDate,
  amount: rupees(amount),
  paid: rupees(paid),
  batchId: `${centre}/${batch}`,
  batch,
  centre,
});

/** The brief's three sample students. */
const aarav = row("aarav", "2026-10-10", 30000, 30000);
const ishita = row("ishita", "2026-10-10", 30000, 15000);
const mohit = row("mohit", "2026-11-15", 40000, 0);

describe("ageingBucket", () => {
  it("has no bucket until a due date has passed", () => {
    expect(ageingBucket(-13)).toBeNull();
    expect(ageingBucket(0)).toBeNull();
  });

  it("puts the edges in the right bucket", () => {
    expect(ageingBucket(1)).toBe("upTo30");
    expect(ageingBucket(30)).toBe("upTo30");
    expect(ageingBucket(31)).toBe("upTo60");
    expect(ageingBucket(60)).toBe("upTo60");
    expect(ageingBucket(61)).toBe("over60");
  });
});

describe("summariseDues", () => {
  it("adds up the brief's sample students", () => {
    expect(summariseDues([aarav, ishita, mohit], TODAY)).toEqual({
      students: 3,
      billed: rupees(100000),
      collected: rupees(45000),
      outstanding: rupees(55000),
      overdue: rupees(15000),
      ageing: {
        upTo30: { amount: rupees(15000), students: 1 },
        upTo60: { amount: 0, students: 0 },
        over60: { amount: 0, students: 0 },
      },
    });
  });

  it("counts a part payment as reducing the aged amount", () => {
    const { ageing } = summariseDues([row("a", "2026-08-01", 30000, 10000)], TODAY);
    expect(ageing.over60).toEqual({ amount: rupees(20000), students: 1 });
  });

  it("leaves a paid instalment out of ageing however old it is", () => {
    const { ageing, overdue } = summariseDues([row("a", "2026-07-10", 30000, 30000)], TODAY);
    expect(overdue).toBe(0);
    expect(ageing.over60.students).toBe(0);
  });

  it("does not count an instalment due today as overdue", () => {
    const { outstanding, overdue } = summariseDues([row("a", TODAY, 30000, 0)], TODAY);
    expect(outstanding).toBe(rupees(30000));
    expect(overdue).toBe(0);
  });

  it("counts a student once per bucket, and in each bucket they fall in", () => {
    const { ageing, students } = summariseDues(
      [
        row("a", "2026-10-20", 10000, 0),
        row("a", "2026-10-25", 10000, 0),
        row("a", "2026-08-01", 10000, 0),
      ],
      TODAY,
    );
    expect(students).toBe(1);
    expect(ageing.upTo30).toEqual({ amount: rupees(20000), students: 1 });
    expect(ageing.over60).toEqual({ amount: rupees(10000), students: 1 });
  });

  it("always balances: billed is collected plus outstanding, and buckets add up to overdue", () => {
    const rows = [
      aarav,
      ishita,
      mohit,
      row("b", "2026-09-20", 30000, 5000),
      row("c", "2026-07-10", 40000, 0),
    ];
    const summary = summariseDues(rows, TODAY);
    const { upTo30, upTo60, over60 } = summary.ageing;

    expect(summary.collected + summary.outstanding).toBe(summary.billed);
    expect(upTo30.amount + upTo60.amount + over60.amount).toBe(summary.overdue);
  });

  it("is all zeros with no data", () => {
    const summary = summariseDues([], TODAY);
    expect(summary.students).toBe(0);
    expect(summary.billed).toBe(0);
  });
});

describe("duesByBatch", () => {
  it("keeps the same batch name at two centres apart, sorted by centre", () => {
    const rows = duesByBatch(
      [
        row("a", "2026-10-10", 30000, 0, "NEET 2027 Morning", "Centre 2"),
        row("b", "2026-10-10", 30000, 0, "JEE 2027 Morning", "Centre 2"),
        row("c", "2026-10-10", 30000, 30000, "JEE 2027 Morning", "Centre 1"),
      ],
      TODAY,
    );

    expect(rows.map((item) => [item.centre, item.batch, item.overdue])).toEqual([
      ["Centre 1", "JEE 2027 Morning", 0],
      ["Centre 2", "JEE 2027 Morning", rupees(30000)],
      ["Centre 2", "NEET 2027 Morning", rupees(30000)],
    ]);
  });

  it("has rows that add up to the overall summary", () => {
    const all = [
      row("a", "2026-10-10", 30000, 10000, "JEE 2027 Morning", "Centre 1"),
      row("b", "2026-08-10", 30000, 0, "NEET 2027 Morning", "Centre 2"),
    ];
    const rows = duesByBatch(all, TODAY);
    const total = summariseDues(all, TODAY);

    expect(rows.reduce((sum, item) => sum + item.outstanding, 0)).toBe(total.outstanding);
    expect(rows.reduce((sum, item) => sum + item.students, 0)).toBe(total.students);
  });
});
