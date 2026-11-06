import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/webhooks/payment/route";
import { db, sqlClient } from "@/db/client";
import {
  batches,
  centres,
  instalments,
  monthCloses,
  otpCodes,
  payments,
  refunds,
  students,
  users,
} from "@/db/schema";
import { rupees } from "@/domain/money";
import { monthReport } from "./books";
import { istDate, today } from "./clock";
import { env } from "./env";
import { isMonthClosed, paymentEventSchema, recordPayment } from "./payments";
import { requestOtp } from "./otp-service";
import { approveRefund, markRefundPaid, saveRefund } from "./refunds";
import { readSession, signSession } from "./session";
import { signBody } from "./signing";

const event = {
  gatewayRef: "SEC-1",
  instalmentRef: null,
  amountPaise: 100,
  paidAt: "2026-10-05T06:00:00.000Z",
};

const hook = (body: object) => {
  const raw = JSON.stringify(body);
  return POST(
    new Request("http://test/api/webhooks/payment", {
      method: "POST",
      headers: { "x-gateway-signature": signBody(raw, env.GATEWAY_WEBHOOK_SECRET) },
      body: raw,
    }),
  );
};

let maker: string;
let checker: string;
let studentId: string;
let instalmentId: string;

const closeMonthDirectly = (month: string, closedOn: string) =>
  db.insert(monthCloses).values({ month, closedOn, closedBy: maker });

beforeEach(async () => {
  await db.execute(
    sql`truncate table month_closes, audit_events, otp_codes, refunds, reminders, payments, instalments, students, users, batches, centres cascade`,
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
  studentId = student.id;
  const [instalment] = await db
    .insert(instalments)
    .values({ studentId, sequence: 1, dueDate: "2026-07-10", amountPaise: rupees(120000) })
    .returning();
  instalmentId = instalment.id;
});

afterAll(async () => {
  await sqlClient.end();
});

describe("a webhook must never lose real money", () => {
  it("keeps a payment with a very long note, and trims the note", async () => {
    const response = await hook({ ...event, note: "x".repeat(5000) });
    expect(response.status).toBe(200);
    const [row] = await db.select().from(payments);
    expect(row.payerNote).toHaveLength(200);
  });

  it("keeps a payment whose note is not even text", async () => {
    expect((await hook({ ...event, note: { evil: true } })).status).toBe(200);
    expect((await db.select().from(payments))[0].payerNote).toBeNull();
  });

  it("sends a reference too long to be ours to the queue", async () => {
    expect((await hook({ ...event, instalmentRef: "y".repeat(500) })).status).toBe(200);
    expect((await db.select().from(payments))[0].status).toBe("unmatched");
  });

  it("refuses an amount no column can hold, with a clean error", async () => {
    expect((await hook({ ...event, amountPaise: 9_000_000_000 })).status).toBe(400);
  });

  it("refuses an oversized body before reading it", async () => {
    const response = await POST(
      new Request("http://test/api/webhooks/payment", {
        method: "POST",
        headers: { "content-length": "9000000" },
        body: "x",
      }),
    );
    expect(response.status).toBe(413);
  });

  it("parses a normal event unchanged", () => {
    expect(paymentEventSchema.parse(event)).toMatchObject({ gatewayRef: "SEC-1", amountPaise: 100 });
  });
});

describe("month end at the client's real volume", () => {
  it("adds up a month above what 32 bits can hold", async () => {
    await db.insert(payments).values(
      [1, 2, 3].map((index) => ({
        gatewayRef: `BIG-${index}`,
        instalmentId,
        amountPaise: 1_000_000_000,
        status: "matched" as const,
        receiptNo: `RCT-00000${index}`,
        paidAt: new Date("2026-10-05T06:00:00.000Z"),
      })),
    );

    const report = await monthReport("2026-10");
    expect(report.checks[0]).toMatchObject({ left: 3_000_000_000, right: 3_000_000_000 });
    expect(report.checks[0].passed).toBe(true);
  });
});

describe("closed means closed", () => {
  it("treats every month up to the latest close as closed", async () => {
    await closeMonthDirectly("2026-09", "2026-10-01");
    expect(await isMonthClosed("2026-09-15")).toBe(true);
    expect(await isMonthClosed("2026-06-15")).toBe(true);
    expect(await isMonthClosed("2026-10-01")).toBe(false);
  });

  it("posts money reported late on today's date, so the closed month does not change", async () => {
    await closeMonthDirectly("2026-09", "2026-10-01");
    await recordPayment({
      gatewayRef: "LATE-1",
      instalmentRef: instalmentId,
      amountPaise: rupees(1000),
      paidAt: "2026-09-20T06:00:00.000Z",
    });

    const [row] = await db.select().from(payments).where(eq(payments.gatewayRef, "LATE-1"));
    expect(istDate(row.paidAt)).toBe(today());
    expect((await monthReport("2026-09")).checks[0]).toMatchObject({ left: 0, right: 0 });
  });

  it("refuses to date a refund payment in a closed month", async () => {
    await recordPayment({
      gatewayRef: "PAID",
      instalmentRef: instalmentId,
      amountPaise: rupees(120000),
      paidAt: "2026-07-10T06:00:00.000Z",
    });
    await saveRefund({ studentId, exitDate: "2026-09-10", createdBy: maker }, "2026-10-05");
    const [refund] = await db.select().from(refunds);
    await approveRefund({ refundId: refund.id, approvedBy: checker }, "2026-10-05");
    await closeMonthDirectly("2026-09", "2026-10-01");

    const pay = (paidOn: string) =>
      markRefundPaid(
        { refundId: refund.id, paidBy: checker, paidOn, method: "upi", reference: "R" },
        "2026-10-05",
      );
    expect(await pay("2026-09-20")).toBe("bad-date");
    expect(await pay("2026-10-02")).toBe("paid");
  });
});

describe("the OTP limit", () => {
  it("holds under parallel requests", async () => {
    const phone = "+919000000002";
    const results = await Promise.all(Array.from({ length: 20 }, () => requestOtp(phone)));
    expect(results.filter((result) => result.status === "sent")).toHaveLength(5);
    expect(await db.select().from(otpCodes)).toHaveLength(5);
  });
});

describe("sessions", () => {
  it("carry a version, so raising it can end them", () => {
    const token = signSession({ userId: "u", version: 3, expiresAt: 2000 }, "s".repeat(32));
    expect(readSession(token, "s".repeat(32), 1000)).toEqual({ userId: "u", version: 3 });
  });

  it("refuses an older token with no version at all", () => {
    const token = signSession(
      { userId: "u", expiresAt: 2000 } as unknown as Parameters<typeof signSession>[0],
      "s".repeat(32),
    );
    expect(readSession(token, "s".repeat(32), 1000)).toBeNull();
  });
});
