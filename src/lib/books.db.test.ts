import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db, sqlClient } from "@/db/client";
import {
  auditEvents,
  batches,
  centres,
  instalments,
  payments,
  reminders,
  students,
  users,
} from "@/db/schema";
import { tallyFileTotals } from "@/domain/books";
import { rupees } from "@/domain/money";
import { tallyCsv } from "@/domain/tally";
import { closeMonth, latestClose, monthReport, queueWithSuggestions } from "./books";
import { tallyReceipts, tallyReversals } from "./dues";
import { instalmentsOf, staffReceipt } from "./ledger";
import {
  applyQueuedPayment,
  recordPayment,
  returnQueuedPayment,
  reversePayment,
} from "./payments";
import { saveRefund } from "./refunds";
import { runReminders } from "./reminders";

const TODAY = "2026-11-02";

let staffId: string;
let studentId: string;
let instalmentId: string;
let counter = 0;

const pay = (amount: number, instalmentRef: string | null = instalmentId, day = "2026-10-05") =>
  recordPayment({
    gatewayRef: `TEST-B-${(counter += 1)}`,
    instalmentRef,
    amountPaise: rupees(amount),
    paidAt: `${day}T06:00:00.000Z`,
  });

const paymentRow = async (id: string) =>
  (await db.select().from(payments).where(eq(payments.id, id)))[0];

beforeEach(async () => {
  await db.execute(
    sql`truncate table month_closes, audit_events, refunds, reminders, payments, instalments, students, users, batches, centres cascade`,
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
      code: "STU-0001",
      name: "Sample Student",
      batchId: batch.id,
      parentId: parent.id,
      planTotalPaise: rupees(30000),
      termStart: "2026-07-01",
      termEnd: "2027-06-30",
    })
    .returning();
  studentId = student.id;
  const [instalment] = await db
    .insert(instalments)
    .values({
      studentId,
      sequence: 1,
      dueDate: "2026-11-01",
      amountPaise: rupees(30000),
    })
    .returning();
  instalmentId = instalment.id;
});

afterAll(async () => {
  await sqlClient.end();
});

describe("applying a queued payment", () => {
  it("marks it paid, issues a receipt, keeps its date and leaves a record", async () => {
    const queued = await pay(30000, null);
    expect(queued.status).toBe("unmatched");

    const outcome = await applyQueuedPayment({
      paymentId: queued.paymentId!,
      instalmentId,
      appliedBy: staffId,
    });
    expect(outcome).toBe("applied");

    const row = await paymentRow(queued.paymentId!);
    expect(row).toMatchObject({ status: "matched", instalmentId, appliedBy: staffId });
    expect(row.receiptNo).toMatch(/^RCT-\d{6}$/);
    expect(row.paidAt.toISOString().slice(0, 10)).toBe("2026-10-05");
    expect((await db.select().from(auditEvents))[0].action).toBe("payment.applied");
  });

  it("stops queued reminders when it clears the balance", async () => {
    await db.insert(reminders).values({
      instalmentId,
      dayOffset: 3,
      language: "en",
      sendOn: "2026-11-04",
    });
    const queued = await pay(30000, null);
    await applyQueuedPayment({ paymentId: queued.paymentId!, instalmentId, appliedBy: staffId });

    const [reminder] = await db.select().from(reminders);
    expect(reminder).toMatchObject({ status: "stopped", stoppedReason: "paid" });
  });

  it("refuses more than the balance, and changes nothing", async () => {
    const queued = await pay(40000, null);
    const outcome = await applyQueuedPayment({
      paymentId: queued.paymentId!,
      instalmentId,
      appliedBy: staffId,
    });
    expect(outcome).toBe("does-not-fit");
    expect((await paymentRow(queued.paymentId!)).status).toBe("unmatched");
  });

  it("refuses a student who has left, because the refund is fixed", async () => {
    await saveRefund({ studentId, exitDate: "2026-10-20", createdBy: staffId }, TODAY);
    const queued = await pay(100, null);
    const outcome = await applyQueuedPayment({
      paymentId: queued.paymentId!,
      instalmentId,
      appliedBy: staffId,
    });
    expect(outcome).toBe("does-not-fit");
  });

  it("cannot be applied twice", async () => {
    const queued = await pay(10000, null);
    const apply = () =>
      applyQueuedPayment({ paymentId: queued.paymentId!, instalmentId, appliedBy: staffId });
    expect(await apply()).toBe("applied");
    expect(await apply()).toBe("not-queued");
    expect((await instalmentsOf(studentId))[0].paid).toBe(rupees(10000));
  });

  it("refuses a payment dated in a closed month", async () => {
    const queued = await pay(100, null, "2026-09-05");
    await db.execute(
      sql`insert into month_closes (month, closed_on, closed_by) values ('2026-09', '2026-10-01', ${staffId})`,
    );
    const outcome = await applyQueuedPayment({
      paymentId: queued.paymentId!,
      instalmentId,
      appliedBy: staffId,
    });
    expect(outcome).toBe("month-closed");
  });

  it("suggests the student with the exact balance", async () => {
    await pay(17500);
    await pay(12500, null);
    const { rows } = await queueWithSuggestions();
    expect(rows[0].suggestions[0]).toMatchObject({
      studentCode: "STU-0001",
      reason: "exact-balance",
    });
  });
});

describe("reversing a payment", () => {
  const reverse = (paymentId: string, date = TODAY) =>
    reversePayment({ paymentId, note: "Wrong student", reversedBy: staffId }, date);

  it("reopens the balance, keeps the row and cancels the receipt", async () => {
    const { paymentId } = await pay(30000);
    expect(await reverse(paymentId!)).toBe("reversed");

    expect((await instalmentsOf(studentId))[0].paid).toBe(0);
    const row = await paymentRow(paymentId!);
    expect(row).toMatchObject({ status: "reversed", instalmentId, reversedOn: TODAY });
    expect(row.receiptNo).toMatch(/^RCT-/);
    expect((await staffReceipt(paymentId!))?.reversedOn).toBe(TODAY);
  });

  it("restarts future reminders only, so the parent gets no old ones", async () => {
    await db.insert(reminders).values([
      { instalmentId, dayOffset: 0, language: "en", sendOn: "2026-11-01" },
      { instalmentId, dayOffset: 3, language: "en", sendOn: "2026-11-04" },
    ]);
    const { paymentId } = await pay(30000);
    await reverse(paymentId!);

    const rows = await db.select().from(reminders).orderBy(reminders.dayOffset);
    expect(rows[0]).toMatchObject({ status: "stopped", stoppedReason: "paid" });
    expect(rows[1]).toMatchObject({ status: "queued", stoppedReason: null });

    const sent: string[] = [];
    await runReminders("2026-11-04", async ({ text }) => void sent.push(text));
    expect(sent).toHaveLength(1);
  });

  it("refuses a second reversal and an unmatched payment", async () => {
    const { paymentId } = await pay(100);
    await reverse(paymentId!);
    expect(await reverse(paymentId!)).toBe("not-matched");

    const queued = await pay(100, null);
    expect(await reverse(queued.paymentId!)).toBe("not-matched");
  });

  it("refuses once a student has left, because the refund used that money", async () => {
    const { paymentId } = await pay(100);
    await saveRefund({ studentId, exitDate: "2026-10-20", createdBy: staffId }, TODAY);
    expect(await reverse(paymentId!)).toBe("student-left");
  });

  it("keeps the original receipt in Tally and adds a reversal on the day it happened", async () => {
    const { paymentId } = await pay(30000);
    await reverse(paymentId!, "2026-11-02");
    const all = { centreId: null, batch: null };

    const october = await tallyReceipts({ ...all, from: "2026-10-01", to: "2026-10-31" });
    expect(october).toHaveLength(1);

    const november = await tallyReversals({ ...all, from: "2026-11-01", to: "2026-11-30" });
    expect(november).toMatchObject([{ voucher: "Reversal", paidOn: "2026-11-02" }]);
    expect(tallyFileTotals(tallyCsv(november)).reversals).toBe(rupees(30000));
  });
});

describe("dates at month end", () => {
  it("puts a payment just after midnight in India in the right month", async () => {
    await recordPayment({
      gatewayRef: "TEST-MIDNIGHT",
      instalmentRef: instalmentId,
      amountPaise: rupees(100),
      paidAt: "2026-09-30T18:45:00.000Z",
    });
    const all = { centreId: null, batch: null };

    expect(await tallyReceipts({ ...all, from: "2026-09-01", to: "2026-09-30" })).toHaveLength(0);
    const october = await tallyReceipts({ ...all, from: "2026-10-01", to: "2026-10-31" });
    expect(october[0].paidOn).toBe("2026-10-01");
  });
});

describe("month end", () => {
  it("shows the ledger and the Tally file agreeing", async () => {
    await pay(12345);
    const report = await monthReport("2026-10");
    expect(report.passed).toBe(true);
    expect(report.checks[0]).toMatchObject({ left: rupees(12345), right: rupees(12345) });
  });

  it("will not close with money in the queue, or before the month is over", async () => {
    await pay(100, null);
    expect(await closeMonth({ month: "2026-10", closedBy: staffId }, TODAY)).toBe("checks-failed");
    expect(await closeMonth({ month: "2026-11", closedBy: staffId }, TODAY)).toBe("month-not-over");
  });

  it("closes once, records it, and reports the days taken", async () => {
    await pay(100);
    const close = () => closeMonth({ month: "2026-10", closedBy: staffId }, "2026-11-01");
    expect(await close()).toBe("closed");
    expect(await close()).toBe("already-closed");
    expect(await latestClose()).toEqual({ month: "2026-10", days: 1 });
  });
});

describe("returning queued money", () => {
  const returnIt = (paymentId: string) =>
    returnQueuedPayment({ paymentId, note: "Sent back by NEFT", returnedBy: staffId }, TODAY);

  it("clears the queue so the month can close, and keeps the row", async () => {
    const queued = await pay(100, null);
    expect(await closeMonth({ month: "2026-10", closedBy: staffId }, TODAY)).toBe("checks-failed");

    expect(await returnIt(queued.paymentId!)).toBe(true);
    expect(await paymentRow(queued.paymentId!)).toMatchObject({
      status: "returned",
      instalmentId: null,
      reversalNote: "Sent back by NEFT",
    });
    expect(await closeMonth({ month: "2026-10", closedBy: staffId }, TODAY)).toBe("closed");
  });

  it("never counts as money received, in the ledger or the Tally file", async () => {
    const queued = await pay(100, null);
    await returnIt(queued.paymentId!);
    const report = await monthReport("2026-10");
    expect(report.checks[0]).toMatchObject({ left: 0, right: 0 });
    expect(report.checks[1]).toMatchObject({ left: 0, right: 0 });
  });

  it("only works on queued money, and only once", async () => {
    const matched = await pay(100);
    expect(await returnIt(matched.paymentId!)).toBe(false);

    const queued = await pay(100, null);
    expect(await returnIt(queued.paymentId!)).toBe(true);
    expect(await returnIt(queued.paymentId!)).toBe(false);
  });
});

describe("the audit log", () => {
  it("refuses any change or delete, at the database", async () => {
    const { paymentId } = await pay(100);
    await reversePayment({ paymentId: paymentId!, note: "Wrong", reversedBy: staffId }, TODAY);

    await expect(db.update(auditEvents).set({ action: "month.closed" })).rejects.toThrow();
    await expect(db.delete(auditEvents)).rejects.toThrow();
    expect(await db.select().from(auditEvents)).toHaveLength(1);
  });
});
