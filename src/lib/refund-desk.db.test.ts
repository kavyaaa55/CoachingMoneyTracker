import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db, sqlClient } from "@/db/client";
import { batches, centres, instalments, students, refunds, users } from "@/db/schema";
import { rupees } from "@/domain/money";
import { tallyCreditNotes } from "./dues";
import { recordPayment } from "./payments";
import { approveRefund, creditNote, listRefunds, markRefundPaid, saveRefund } from "./refunds";

const TODAY = "2026-11-02";

let maker: string;
let checker: string;
let refundId: string;

const refundRow = async () => (await db.select().from(refunds).where(eq(refunds.id, refundId)))[0];
const pay = (paidOn = "2026-11-01") =>
  markRefundPaid(
    { refundId, paidBy: checker, paidOn, method: "bank_transfer", reference: "NEFT-1" },
    TODAY,
  );

beforeEach(async () => {
  await db.execute(
    sql`truncate table refunds, reminders, payments, instalments, students, users, batches, centres cascade`,
  );
  const [centre] = await db.insert(centres).values({ name: "Centre 1" }).returning();
  const [batch] = await db
    .insert(batches)
    .values({ name: "JEE 2027 Morning", centreId: centre.id })
    .returning();
  const [parent, first, second] = await db
    .insert(users)
    .values([
      { phone: "+919000000002", name: "Parent", role: "parent" as const },
      { phone: "+919000000100", name: "Maker", role: "accounts" as const },
      { phone: "+919000000101", name: "Checker", role: "accounts" as const },
    ])
    .returning();
  maker = first.id;
  checker = second.id;

  const [student] = await db
    .insert(students)
    .values({
      code: "STU-0001",
      name: "Sample Student",
      batchId: batch.id,
      parentId: parent.id,
      planTotalPaise: rupees(120000),
      termStart: "2026-07-01",
      termEnd: "2027-06-30",
    })
    .returning();
  const [instalment] = await db
    .insert(instalments)
    .values({
      studentId: student.id,
      sequence: 1,
      dueDate: "2026-07-10",
      amountPaise: rupees(120000),
    })
    .returning();
  await recordPayment({
    gatewayRef: "TEST-DESK",
    instalmentRef: instalment.id,
    amountPaise: rupees(120000),
    paidAt: "2026-07-10T06:00:00.000Z",
  });

  await saveRefund({ studentId: student.id, exitDate: "2026-10-30", createdBy: maker }, TODAY);
  refundId = (await db.select().from(refunds))[0].id;
});

afterAll(async () => {
  await sqlClient.end();
});

describe("refund approval", () => {
  it("refuses the person who saved it", async () => {
    expect(await approveRefund({ refundId, approvedBy: maker }, TODAY)).toBe("same-person");
    expect((await refundRow()).status).toBe("calculated");
  });

  it("is also refused by the database, whatever the code does", async () => {
    await expect(
      db.update(refunds).set({ approvedBy: maker }).where(eq(refunds.id, refundId)),
    ).rejects.toThrow();
  });

  it("lets a second person approve, once", async () => {
    expect(await approveRefund({ refundId, approvedBy: checker }, TODAY)).toBe("approved");
    expect(await refundRow()).toMatchObject({ status: "approved", approvedOn: TODAY });
    expect(await approveRefund({ refundId, approvedBy: checker }, TODAY)).toBe("not-waiting");
  });

  it("has nothing to approve on a ₹0 refund", async () => {
    await db.update(refunds).set({ refundPaise: 0 }).where(eq(refunds.id, refundId));
    expect(await approveRefund({ refundId, approvedBy: checker }, TODAY)).toBe("not-waiting");
  });
});

describe("paying a refund", () => {
  it("cannot happen before approval", async () => {
    expect(await pay()).toBe("not-approved");
    expect((await refundRow()).creditNoteNo).toBeNull();
  });

  it("refuses a future date or a date before the student left", async () => {
    await approveRefund({ refundId, approvedBy: checker }, TODAY);
    expect(await pay("2026-11-03")).toBe("bad-date");
    expect(await pay("2026-10-29")).toBe("bad-date");
  });

  it("issues one credit note, which reaches the Tally export", async () => {
    await approveRefund({ refundId, approvedBy: checker }, TODAY);
    expect(await pay()).toBe("paid");
    expect(await pay()).toBe("not-approved");

    const row = await refundRow();
    expect(row.creditNoteNo).toMatch(/^CN-\d{6}$/);
    expect((await creditNote(refundId))?.amount).toBe(row.refundPaise);

    const range = { centreId: null, batch: null, from: "2026-11-01", to: "2026-11-30" };
    const notes = await tallyCreditNotes(range);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ voucher: "Credit Note", amount: row.refundPaise });
  });

  it("has no credit note to show before it is paid", async () => {
    expect(await creditNote(refundId)).toBeNull();
  });
});

describe("the desk", () => {
  it("lists refunds with their deadline", async () => {
    const [row] = await listRefunds();
    expect(row).toMatchObject({ studentCode: "STU-0001", dueBy: "2026-11-09", status: "calculated" });
  });
});
