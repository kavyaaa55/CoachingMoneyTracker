import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/webhooks/payment/route";
import { db, sqlClient } from "@/db/client";
import { batches, centres, instalments, payments, students, users } from "@/db/schema";
import { balanceOf } from "@/domain/instalments";
import { rupees } from "@/domain/money";
import { env } from "./env";
import { instalmentById } from "./ledger";
import { recordPayment } from "./payments";
import { signBody } from "./signing";

let instalmentId: string;
let counter = 0;

const event = (amount: number, overrides = {}) => ({
  gatewayRef: `TEST-${(counter += 1)}`,
  instalmentRef: instalmentId,
  amountPaise: rupees(amount),
  paidAt: "2026-11-02T06:00:00.000Z",
  ...overrides,
});

const balance = async () => balanceOf((await instalmentById(instalmentId))!);
const allPayments = () => db.select().from(payments);

beforeEach(async () => {
  await db.execute(
    sql`truncate table payments, instalments, students, users, batches, centres cascade`,
  );
  const [centre] = await db.insert(centres).values({ name: "Centre 1" }).returning();
  const [batch] = await db
    .insert(batches)
    .values({ name: "JEE 2027 Evening", centreId: centre.id })
    .returning();
  const [parent] = await db
    .insert(users)
    .values({ phone: "+919000000002", name: "Parent", role: "parent" })
    .returning();
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
  const [instalment] = await db
    .insert(instalments)
    .values({
      studentId: student.id,
      sequence: 2,
      dueDate: "2026-10-10",
      amountPaise: rupees(30000),
    })
    .returning();
  instalmentId = instalment.id;
});

afterAll(() => sqlClient.end());

describe("recordPayment", () => {
  it("marks an instalment paid and issues a receipt", async () => {
    const result = await recordPayment(event(30000));

    expect(result).toMatchObject({ status: "matched", duplicate: false });
    expect(await balance()).toBe(0);
    const [payment] = await allPayments();
    expect(payment.receiptNo).toMatch(/^RCT-\d{6}$/);
  });

  it("applies part payments until the balance is cleared", async () => {
    await recordPayment(event(15000));
    expect(await balance()).toBe(rupees(15000));

    await recordPayment(event(15000));
    expect(await balance()).toBe(0);
  });

  it("gives each payment its own receipt number", async () => {
    await recordPayment(event(10000));
    await recordPayment(event(10000));

    const numbers = (await allPayments()).map((payment) => payment.receiptNo);
    expect(new Set(numbers).size).toBe(2);
  });

  it("ignores a repeat of the same event", async () => {
    const same = event(15000);
    const first = await recordPayment(same);
    const second = await recordPayment(same);

    expect(second).toMatchObject({ paymentId: first.paymentId, duplicate: true });
    expect(await allPayments()).toHaveLength(1);
    expect(await balance()).toBe(rupees(15000));
  });

  it("counts an event once when repeats arrive together", async () => {
    const same = event(15000);
    const results = await Promise.all(Array.from({ length: 6 }, () => recordPayment(same)));

    expect(new Set(results.map((result) => result.paymentId)).size).toBe(1);
    expect(await allPayments()).toHaveLength(1);
    expect(await balance()).toBe(rupees(15000));
  });

  it("queues a payment with no reference and marks nothing paid", async () => {
    const result = await recordPayment(event(30000, { instalmentRef: null }));

    expect(result).toMatchObject({ status: "unmatched", studentId: null });
    expect(await balance()).toBe(rupees(30000));
    const [payment] = await allPayments();
    expect(payment).toMatchObject({
      instalmentId: null,
      receiptNo: null,
      unmatchedReason: "no-instalment",
    });
  });

  it("queues a reference that is not an instalment", async () => {
    const random = "00000000-0000-4000-8000-000000000000";

    expect(await recordPayment(event(100, { instalmentRef: random }))).toMatchObject({
      status: "unmatched",
    });
    expect(await recordPayment(event(100, { instalmentRef: "not-a-uuid" }))).toMatchObject({
      status: "unmatched",
    });
  });

  it("queues an overpayment, keeps the claim and marks nothing paid", async () => {
    const result = await recordPayment(event(30001));

    expect(result.status).toBe("unmatched");
    expect(await balance()).toBe(rupees(30000));
    const [payment] = await allPayments();
    expect(payment).toMatchObject({ claimedRef: instalmentId, unmatchedReason: "amount-too-high" });
  });

  it("queues a new payment on an instalment that is already paid", async () => {
    await recordPayment(event(30000));
    const result = await recordPayment(event(30000));

    expect(result.status).toBe("unmatched");
    expect(await balance()).toBe(0);
  });

  it("never lets two payments together exceed the balance", async () => {
    const results = await Promise.all([recordPayment(event(20000)), recordPayment(event(20000))]);

    expect(results.map((result) => result.status).sort()).toEqual(["matched", "unmatched"]);
    expect(await balance()).toBe(rupees(10000));
  });
});

describe("payment webhook", () => {
  const post = (body: string, signature: string | null) =>
    POST(
      new Request("http://localhost/api/webhooks/payment", {
        method: "POST",
        body,
        headers: signature ? { "x-gateway-signature": signature } : {},
      }),
    );
  const sign = (body: string) => signBody(body, env.GATEWAY_WEBHOOK_SECRET);

  it("accepts a signed event", async () => {
    const body = JSON.stringify(event(30000));
    const response = await post(body, sign(body));

    expect(response.status).toBe(200);
    expect(await balance()).toBe(0);
  });

  it("rejects a missing or wrong signature", async () => {
    const body = JSON.stringify(event(30000));

    expect((await post(body, null)).status).toBe(401);
    expect((await post(body, "wrong")).status).toBe(401);
    expect(await balance()).toBe(rupees(30000));
  });

  it("rejects a changed body", async () => {
    const body = JSON.stringify(event(100));
    const changed = body.replace(String(rupees(100)), String(rupees(30000)));

    expect((await post(changed, sign(body))).status).toBe(401);
    expect(await allPayments()).toHaveLength(0);
  });

  it("rejects bad events even when signed", async () => {
    for (const body of ["not json", "{}", JSON.stringify(event(-5))]) {
      expect((await post(body, sign(body))).status).toBe(400);
    }
    expect(await allPayments()).toHaveLength(0);
  });
});
