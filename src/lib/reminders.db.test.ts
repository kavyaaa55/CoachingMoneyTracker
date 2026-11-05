import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/cron/reminders/route";
import { db, sqlClient } from "@/db/client";
import {
  batches,
  centres,
  instalments,
  payments,
  reminders,
  students,
  users,
} from "@/db/schema";
import { addDays } from "@/domain/dates";
import { rupees } from "@/domain/money";
import { REMINDER_OFFSETS } from "@/domain/reminders";
import { env } from "./env";
import { recordPayment } from "./payments";
import { runReminders, type Sender } from "./reminders";

const DUE = "2026-11-15";

let instalmentId: string;
let studentId: string;
let parentId: string;
let counter = 0;

const sender = () => vi.fn<Sender>(async () => {});
const rows = () => db.select().from(reminders).where(eq(reminders.instalmentId, instalmentId));
const byOffset = async (offset: number) =>
  (await rows()).find((row) => row.dayOffset === offset)!;

const pay = (amount: number) =>
  recordPayment({
    gatewayRef: `TEST-R-${(counter += 1)}`,
    instalmentRef: instalmentId,
    amountPaise: rupees(amount),
    paidAt: "2026-11-02T06:00:00.000Z",
  });

beforeEach(async () => {
  await db.execute(
    sql`truncate table reminders, payments, instalments, students, users, batches, centres cascade`,
  );
  const [centre] = await db.insert(centres).values({ name: "Centre 1" }).returning();
  const [batch] = await db
    .insert(batches)
    .values({ name: "NEET 2027 Morning", centreId: centre.id })
    .returning();
  const [parent] = await db
    .insert(users)
    .values({ phone: "+919000000003", name: "Parent", role: "parent", language: "en" })
    .returning();
  parentId = parent.id;
  const [student] = await db
    .insert(students)
    .values({
      code: "STU-0219",
      name: "Mohit Gurjar",
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
    .values({ studentId: student.id, sequence: 2, dueDate: DUE, amountPaise: rupees(40000) })
    .returning();
  instalmentId = instalment.id;
});

afterAll(() => sqlClient.end());

describe("runReminders", () => {
  it("queues the stages coming up and sends nothing early", async () => {
    const send = sender();
    const result = await runReminders("2026-11-02", send);

    expect(result).toEqual({ sent: 0, stopped: 0, failed: 0 });
    expect(send).not.toHaveBeenCalled();
    expect((await rows()).map((row) => row.status)).toEqual(Array(3).fill("queued"));
  });

  it("sends every stage on its own day, once", async () => {
    const send = sender();

    for (const offset of REMINDER_OFFSETS) {
      const result = await runReminders(addDays(DUE, offset), send);
      expect(result.sent).toBe(1);
      expect((await byOffset(offset)).status).toBe("sent");
    }

    expect(send).toHaveBeenCalledTimes(REMINDER_OFFSETS.length);
    expect((await rows()).every((row) => row.status === "sent")).toBe(true);
  });

  it("keeps reminding long after the due date, and stops the moment it is paid", async () => {
    const send = sender();
    const late = addDays(DUE, 63);
    await runReminders(late, send);
    expect(send).toHaveBeenCalledTimes(1);
    expect((await byOffset(63)).status).toBe("sent");

    await pay(40000);

    const after = sender();
    await runReminders(addDays(DUE, 91), after);
    expect(after).not.toHaveBeenCalled();
    expect((await rows()).filter((row) => row.status === "queued")).toHaveLength(0);
  });

  it("does not send the same reminder twice on one day", async () => {
    const send = sender();
    await runReminders("2026-11-15", send);
    await runReminders("2026-11-15", send);

    expect(send).toHaveBeenCalledTimes(1);
  });

  it("sends once when two runs start together", async () => {
    const send = sender();
    await runReminders("2026-11-02", send);
    await Promise.all([runReminders("2026-11-08", send), runReminders("2026-11-08", send)]);

    expect(send).toHaveBeenCalledTimes(1);
  });

  it("stops queued reminders the moment the instalment is paid", async () => {
    await runReminders("2026-11-02", sender());
    await pay(40000);

    const all = await rows();
    expect(all.every((row) => row.status === "stopped")).toBe(true);
    expect(all.every((row) => row.stoppedReason === "paid")).toBe(true);
  });

  it("sends nothing after payment", async () => {
    await runReminders("2026-11-02", sender());
    await pay(40000);

    const send = sender();
    await runReminders("2026-11-15", send);

    expect(send).not.toHaveBeenCalled();
  });

  it("rechecks the balance at send time", async () => {
    await runReminders("2026-11-02", sender());
    // Written straight to the table, so only the send-time check can catch it.
    await db.insert(payments).values({
      gatewayRef: "DIRECT",
      instalmentId,
      amountPaise: rupees(40000),
      status: "matched",
      paidAt: new Date(),
    });

    const send = sender();
    const result = await runReminders("2026-11-08", send);

    expect(send).not.toHaveBeenCalled();
    expect(result).toEqual({ sent: 0, stopped: 1, failed: 0 });
    expect(await byOffset(-7)).toMatchObject({ status: "stopped", stoppedReason: "paid" });
  });

  it("keeps reminding after a part payment, for the amount left", async () => {
    await runReminders("2026-11-02", sender());
    await pay(15000);

    const send = sender();
    await runReminders("2026-11-08", send);

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].text).toContain("₹25,000");
  });

  it("does not plan reminders for a paid instalment", async () => {
    await pay(40000);
    await runReminders("2026-11-02", sender());

    expect(await rows()).toHaveLength(0);
  });

  it("uses the parent's current language", async () => {
    await runReminders("2026-11-02", sender());
    await db.update(users).set({ language: "hi" }).where(eq(users.id, parentId));

    const send = sender();
    await runReminders("2026-11-08", send);

    expect(send.mock.calls[0][0].text).toContain("देय है");
    expect((await byOffset(-7)).language).toBe("hi");
  });

  it("sends only the latest stage after missed days", async () => {
    await runReminders("2026-11-02", sender());

    const send = sender();
    const result = await runReminders("2026-11-18", send);

    expect(send).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ sent: 1, stopped: 3, failed: 0 });
    expect((await byOffset(3)).status).toBe("sent");
    expect(await byOffset(-7)).toMatchObject({ status: "stopped", stoppedReason: "superseded" });
  });

  it("keeps a failed reminder queued and retries it", async () => {
    await runReminders("2026-11-02", sender());

    const failing: Sender = async () => {
      throw new Error("Provider down");
    };
    expect((await runReminders("2026-11-08", failing)).failed).toBe(1);
    expect((await byOffset(-7)).status).toBe("queued");

    const send = sender();
    expect((await runReminders("2026-11-08", send)).sent).toBe(1);
  });

  it("stops reminders once a student has left", async () => {
    await runReminders("2026-11-02", sender());
    await db.update(students).set({ exitDate: "2026-11-03" }).where(eq(students.id, studentId));

    const send = sender();
    await runReminders("2026-11-08", send);

    expect(send).not.toHaveBeenCalled();
    expect((await byOffset(-7)).stoppedReason).toBe("student-left");
  });

  it("stores the message it sent", async () => {
    await runReminders("2026-11-15", sender());

    const { message } = await byOffset(0);
    expect(message).toContain("₹40,000");
    expect(message).toContain("/gateway/");
  });
});

describe("cron route", () => {
  const call = (authorization?: string) =>
    GET(
      new Request("http://localhost/api/cron/reminders", {
        headers: authorization ? { authorization } : {},
      }),
    );

  it("refuses a missing or wrong secret", async () => {
    expect((await call()).status).toBe(401);
    expect((await call("Bearer wrong")).status).toBe(401);
  });

  it("runs with the right secret", async () => {
    const response = await call(`Bearer ${env.CRON_SECRET}`);

    expect(response.status).toBe(200);
    expect(await response.json()).toHaveProperty("sent");
  });
});
