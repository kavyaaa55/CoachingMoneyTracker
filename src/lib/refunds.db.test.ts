import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db, sqlClient } from "@/db/client";
import {
  batches,
  centres,
  instalments,
  payments,
  refunds,
  reminders,
  students,
  users,
} from "@/db/schema";
import { rupees } from "@/domain/money";
import { recordPayment } from "./payments";
import { refundOf, saveRefund } from "./refunds";
import { runReminders, type Sender } from "./reminders";

const TODAY = "2026-11-02";

let studentId: string;
let staffId: string;
let firstInstalment: string;
let secondInstalment: string;
let counter = 0;

const pay = (instalmentRef: string, amount: number) =>
  recordPayment({
    gatewayRef: `TEST-F-${(counter += 1)}`,
    instalmentRef,
    amountPaise: rupees(amount),
    paidAt: "2026-09-01T06:00:00.000Z",
  });

const save = (exitDate: string) => saveRefund({ studentId, exitDate, createdBy: staffId }, TODAY);

const studentRow = async () =>
  (await db.select().from(students).where(eq(students.id, studentId)))[0];

beforeEach(async () => {
  await db.execute(
    sql`truncate table refunds, reminders, payments, instalments, students, users, batches, centres cascade`,
  );
  const [centre] = await db.insert(centres).values({ name: "Centre 1" }).returning();
  const [batch] = await db
    .insert(batches)
    .values({ name: "JEE 2027 Morning", centreId: centre.id })
    .returning();
  const [parent, staff] = await db
    .insert(users)
    .values([
      { phone: "+919000000002", name: "Parent", role: "parent" as const },
      { phone: "+919000000100", name: "Staff", role: "accounts" as const },
    ])
    .returning();
  staffId = staff.id;
  const [student] = await db
    .insert(students)
    .values({
      code: "STU-0587",
      name: "Ishita Sharma",
      batchId: batch.id,
      parentId: parent.id,
      planTotalPaise: rupees(120000),
      termStart: "2026-07-01",
      termEnd: "2027-06-30",
    })
    .returning();
  studentId = student.id;
  const [first, second] = await db
    .insert(instalments)
    .values([
      { studentId, sequence: 1, dueDate: "2026-07-10", amountPaise: rupees(30000) },
      { studentId, sequence: 2, dueDate: "2026-11-15", amountPaise: rupees(30000) },
    ])
    .returning();
  firstInstalment = first.id;
  secondInstalment = second.id;
});

afterAll(() => sqlClient.end());

describe("saveRefund", () => {
  it("records the working, with the amount paid across instalments", async () => {
    await pay(firstInstalment, 30000);
    await pay(secondInstalment, 15000);

    expect(await save("2026-10-12")).toBe("saved");

    expect(await refundOf(studentId)).toMatchObject({
      exitDate: "2026-10-12",
      netFeePaise: rupees(120000),
      paidPaise: rupees(45000),
      termDays: 365,
      daysUsed: 104,
      feeUsedPaise: rupees(34192),
      refundPaise: rupees(10808),
      dueBy: "2026-10-22",
      createdBy: staffId,
    });
    expect((await studentRow()).exitDate).toBe("2026-10-12");
  });

  it("uses the fee after discount", async () => {
    await db
      .update(students)
      .set({ discountPaise: rupees(6000) })
      .where(eq(students.id, studentId));
    await pay(firstInstalment, 30000);
    await pay(secondInstalment, 15000);

    await save("2026-10-12");

    expect(await refundOf(studentId)).toMatchObject({
      netFeePaise: rupees(114000),
      feeUsedPaise: rupees(32482),
      refundPaise: rupees(12518),
    });
  });

  it("saves a zero refund when less was paid than used", async () => {
    await pay(firstInstalment, 10000);

    expect(await save("2026-10-12")).toBe("saved");
    expect((await refundOf(studentId))?.refundPaise).toBe(0);
  });

  it("ignores unmatched payments", async () => {
    await pay(firstInstalment, 30000);
    await pay(firstInstalment, 5000);

    await save("2026-10-12");

    expect((await refundOf(studentId))?.paidPaise).toBe(rupees(30000));
  });

  it("works for a student with no instalments", async () => {
    await db.delete(instalments);

    expect(await save("2026-10-12")).toBe("saved");
    expect((await refundOf(studentId))?.paidPaise).toBe(0);
  });

  it("stops queued reminders straight away and leaves sent ones alone", async () => {
    await pay(firstInstalment, 30000);
    const send = vi.fn<Sender>(async () => {});
    await runReminders("2026-11-08", send);
    expect(send).toHaveBeenCalledTimes(1);

    await save("2026-10-12");

    const rows = await db
      .select()
      .from(reminders)
      .where(eq(reminders.instalmentId, secondInstalment));
    expect(rows.filter((row) => row.status === "sent")).toHaveLength(1);
    expect(rows.filter((row) => row.status === "queued")).toHaveLength(0);
    expect(rows.filter((row) => row.stoppedReason === "student-left")).toHaveLength(4);
  });

  it("sends nothing on later job runs", async () => {
    await save("2026-10-12");
    const send = vi.fn<Sender>(async () => {});

    await runReminders("2026-11-15", send);

    expect(send).not.toHaveBeenCalled();
  });

  it("saves only once and keeps the first figures", async () => {
    await pay(firstInstalment, 30000);
    await save("2026-10-12");

    expect(await save("2026-11-01")).toBe("already-saved");

    expect(await db.select().from(refunds)).toHaveLength(1);
    expect((await refundOf(studentId))?.exitDate).toBe("2026-10-12");
  });

  it("counts one refund when two saves race", async () => {
    const outcomes = await Promise.all([save("2026-10-12"), save("2026-10-12")]);

    expect(outcomes.sort()).toEqual(["already-saved", "saved"]);
  });

  it("refuses a future date and changes nothing", async () => {
    expect(await save("2026-11-03")).toBe("future-date");

    expect(await refundOf(studentId)).toBeNull();
    expect((await studentRow()).exitDate).toBeNull();
  });

  it("refuses a mistyped year", async () => {
    expect(await save("2006-10-12")).toBe("invalid-date");
    expect(await refundOf(studentId)).toBeNull();
  });

  it("reports a student that does not exist", async () => {
    const outcome = await saveRefund(
      {
        studentId: "00000000-0000-4000-8000-000000000000",
        exitDate: "2026-10-12",
        createdBy: staffId,
      },
      TODAY,
    );
    expect(outcome).toBe("not-found");
  });
});

describe("payments after a refund is saved", () => {
  beforeEach(async () => {
    await save("2026-10-12");
  });

  it("sends a gateway payment to the queue and marks nothing paid", async () => {
    const result = await pay(secondInstalment, 30000);

    expect(result.status).toBe("unmatched");
    const [row] = await db.select().from(payments);
    expect(row).toMatchObject({
      instalmentId: null,
      unmatchedReason: "student-left",
      receiptNo: null,
      claimedRef: secondInstalment,
    });
  });

  it("refuses a manual payment and saves nothing", async () => {
    const result = await recordPayment(
      {
        gatewayRef: "MANUAL-TEST-LEFT",
        instalmentRef: secondInstalment,
        amountPaise: rupees(1000),
        paidAt: "2026-11-02T06:30:00.000Z",
      },
      { method: "cash", externalRef: null, recordedBy: staffId },
    );

    expect(result.status).toBe("rejected");
    expect(await db.select().from(payments)).toHaveLength(0);
  });
});
