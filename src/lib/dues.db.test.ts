import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db, sqlClient } from "@/db/client";
import { batches, centres, instalments, students, users } from "@/db/schema";
import { duesByBatch, summariseDues } from "@/domain/dues";
import { rupees } from "@/domain/money";
import {
  allBatchNames,
  countStudentsLeft,
  duesInstalments,
  tallyReceipts,
  unmatchedQueue,
} from "./dues";
import { recordPayment } from "./payments";
import { saveRefund } from "./refunds";

const TODAY = "2026-11-02";
const all = { centreId: null, batch: null };

let centreOne: string;
let centreTwo: string;
let counter = 0;

const pay = (instalmentRef: string, amount: number, paidAt = "2026-10-05T06:00:00.000Z") =>
  recordPayment({
    gatewayRef: `TEST-D-${(counter += 1)}`,
    instalmentRef,
    amountPaise: rupees(amount),
    paidAt,
  });

beforeAll(async () => {
  await db.execute(
    sql`truncate table refunds, reminders, payments, instalments, students, users, batches, centres cascade`,
  );
  const [one, two] = await db
    .insert(centres)
    .values([{ name: "Centre 1" }, { name: "Centre 2" }])
    .returning();
  centreOne = one.id;
  centreTwo = two.id;
  const [jeeOne, jeeTwo, neetTwo] = await db
    .insert(batches)
    .values([
      { name: "JEE 2027 Morning", centreId: one.id },
      { name: "JEE 2027 Morning", centreId: two.id },
      { name: "NEET 2027 Evening", centreId: two.id },
    ])
    .returning();
  const [parent, staff] = await db
    .insert(users)
    .values([
      { phone: "+919000000001", name: "Parent", role: "parent" as const },
      { phone: "+919000000100", name: "Staff", role: "accounts" as const },
    ])
    .returning();

  const addStudent = async (code: string, batchId: string) => {
    const [student] = await db
      .insert(students)
      .values({
        code,
        name: code,
        batchId,
        parentId: parent.id,
        planTotalPaise: rupees(60000),
        termStart: "2026-07-01",
        termEnd: "2027-06-30",
      })
      .returning();
    const [first, second] = await db
      .insert(instalments)
      .values([
        { studentId: student.id, sequence: 1, dueDate: "2026-08-01", amountPaise: rupees(30000) },
        { studentId: student.id, sequence: 2, dueDate: "2026-11-15", amountPaise: rupees(30000) },
      ])
      .returning();
    return { student, first, second };
  };

  const a = await addStudent("STU-A", jeeOne.id);
  const b = await addStudent("STU-B", jeeTwo.id);
  const c = await addStudent("STU-C", neetTwo.id);
  const gone = await addStudent("STU-GONE", neetTwo.id);

  await pay(a.first.id, 30000);
  await pay(b.first.id, 10000, "2026-09-30T23:59:59.000Z");
  await pay(c.first.id, 5000, "2026-11-01T00:00:00.000Z");
  await pay(gone.first.id, 20000);
  await pay(a.first.id, 500);

  await saveRefund(
    { studentId: gone.student.id, exitDate: "2026-10-12", createdBy: staff.id },
    TODAY,
  );
});

afterAll(() => sqlClient.end());

describe("duesInstalments", () => {
  it("gives totals from real payments, without the student who left", async () => {
    const summary = summariseDues(await duesInstalments(all), TODAY);

    expect(summary.students).toBe(3);
    expect(summary.billed).toBe(rupees(180000));
    expect(summary.collected).toBe(rupees(45000));
    expect(summary.outstanding).toBe(rupees(135000));
    expect(summary.overdue).toBe(rupees(45000));
    expect(summary.ageing.over60).toEqual({ amount: rupees(45000), students: 2 });
  });

  it("filters by centre", async () => {
    const summary = summariseDues(
      await duesInstalments({ centreId: centreTwo, batch: null }),
      TODAY,
    );
    expect(summary.students).toBe(2);
    expect(summary.collected).toBe(rupees(15000));
  });

  it("filters by batch name across centres", async () => {
    const rows = duesByBatch(
      await duesInstalments({ centreId: null, batch: "JEE 2027 Morning" }),
      TODAY,
    );
    expect(rows.map((row) => row.centre)).toEqual(["Centre 1", "Centre 2"]);
  });

  it("combines both filters, and is empty when nothing fits", async () => {
    const both = await duesInstalments({ centreId: centreOne, batch: "JEE 2027 Morning" });
    expect(new Set(both.map((row) => row.batchId)).size).toBe(1);

    expect(await duesInstalments({ centreId: centreOne, batch: "NEET 2027 Evening" })).toEqual([]);
  });
});

describe("countStudentsLeft", () => {
  it("counts within the filters", async () => {
    expect(await countStudentsLeft(all)).toBe(1);
    expect(await countStudentsLeft({ centreId: centreOne, batch: null })).toBe(0);
  });
});

describe("allBatchNames", () => {
  it("lists each name once", async () => {
    expect(await allBatchNames()).toEqual(["JEE 2027 Morning", "NEET 2027 Evening"]);
  });
});

describe("unmatchedQueue", () => {
  it("lists only unmatched money, with why it is there and who it was for", async () => {
    await recordPayment({
      gatewayRef: "TEST-D-NO-REF",
      instalmentRef: null,
      amountPaise: rupees(700),
      paidAt: "2026-10-20T06:00:00.000Z",
    });

    const { rows, total } = await unmatchedQueue();

    expect(total).toBe(2);
    expect(rows.map((row) => row.reason)).toEqual(["no-instalment", "amount-too-high"]);
    expect(rows[0].studentCode).toBeNull();
    expect(rows[1]).toMatchObject({ amount: rupees(500), studentCode: "STU-A" });
  });
});

describe("tallyReceipts", () => {
  const october = { ...all, from: "2026-10-01", to: "2026-10-31" };

  it("keeps to the dates, including a student who has since left", async () => {
    const rows = await tallyReceipts(october);

    expect(rows.map((row) => row.studentCode).sort()).toEqual(["STU-A", "STU-GONE"]);
    expect(rows[0]).toMatchObject({ paidOn: "2026-10-05", method: "gateway" });
    expect(rows[0].receiptNo).toMatch(/^RCT-/);
  });

  it("includes both end dates and nothing just outside them", async () => {
    const sept = await tallyReceipts({ ...all, from: "2026-09-30", to: "2026-09-30" });
    const nov = await tallyReceipts({ ...all, from: "2026-11-01", to: "2026-11-01" });

    expect(sept.map((row) => row.studentCode)).toEqual(["STU-B"]);
    expect(nov.map((row) => row.studentCode)).toEqual(["STU-C"]);
  });

  it("leaves out unmatched payments", async () => {
    const rows = await tallyReceipts({ ...all, from: "2026-01-01", to: "2026-12-31" });

    expect(rows).toHaveLength(4);
    expect(rows.every((row) => row.amount !== rupees(500))).toBe(true);
  });

  it("follows the centre and batch filters", async () => {
    const rows = await tallyReceipts({
      from: "2026-01-01",
      to: "2026-12-31",
      centreId: centreTwo,
      batch: "JEE 2027 Morning",
    });
    expect(rows.map((row) => row.studentCode)).toEqual(["STU-B"]);
  });
});
