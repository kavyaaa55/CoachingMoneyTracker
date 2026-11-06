import { eq, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { db, sqlClient } from "@/db/client";
import { loadSampleData } from "@/db/load-sample";
import { SAMPLE_TODAY } from "@/db/sample-data";
import { attendance, payments, pipelineRuns, reminders, students } from "@/db/schema";
import { setDemoToday, today } from "./clock";
import { daysToNextDue, moveDemoDate, resetDemo, storyLinks, syncDemoClock } from "./demo";
import { env } from "./env";
import { instalmentsOf } from "./ledger";
import { recordPayment } from "./payments";
import { liveFeed } from "./simulator";

const studentCalled = async (code: string) =>
  (await db.select().from(students).where(eq(students.code, code)))[0];

// Set here, because CI has no demo settings in its environment.
beforeAll(async () => {
  env.DEMO_MODE = true;
  process.env.APP_TODAY = SAMPLE_TODAY;
  await loadSampleData();
}, 60_000);

afterEach(() => {
  env.DEMO_MODE = true;
});

afterAll(async () => {
  setDemoToday(null);
  await sqlClient.end();
});

describe("the time machine", () => {
  it("is refused outside demo mode, at the lowest level", async () => {
    env.DEMO_MODE = false;
    await expect(moveDemoDate(1)).rejects.toThrow("demo mode");
    await expect(resetDemo()).rejects.toThrow("demo mode");
    await expect(syncDemoClock()).rejects.toThrow("demo mode");
    await expect(storyLinks()).rejects.toThrow("demo mode");
  });

  it("refuses a jump outside the limits", async () => {
    await expect(moveDemoDate(0)).rejects.toThrow();
    await expect(moveDemoDate(1000)).rejects.toThrow();
  });

  it("finds the next due date", async () => {
    expect(await daysToNextDue("2026-11-02")).toBeGreaterThan(0);
  });

  it("stops Ishita's reminders when she pays, then keeps moving", async () => {
    const ishita = await studentCalled("STU-0587");
    const [, second] = await instalmentsOf(ishita.id);
    await recordPayment({
      gatewayRef: "TEST-STORY",
      instalmentRef: second.id,
      amountPaise: second.amount - second.paid,
      paidAt: `${SAMPLE_TODAY}T06:00:00.000Z`,
    });

    await moveDemoDate(14);
    expect(today()).toBe("2026-11-16");

    const [{ late }] = await db
      .select({ late: sql<number>`count(*)::int` })
      .from(reminders)
      .where(
        sql`${reminders.instalmentId} = ${second.id} and ${reminders.status} = 'sent'
            and ${reminders.sendOn} >= ${SAMPLE_TODAY}`,
      );
    expect(late).toBe(0);
  });

  it("counts reminders a payment stopped, not only those the job stopped", async () => {
    const runs = await db.select().from(pipelineRuns).where(eq(pipelineRuns.source, "time-machine"));
    expect(runs.reduce((sum, run) => sum + run.counts.remindersStopped, 0)).toBeGreaterThan(0);
  });

  it("takes in new attendance through the upload path, without rejecting a file", async () => {
    const [{ weeks }] = await db
      .select({ weeks: sql<number>`count(*)::int` })
      .from(attendance)
      .where(eq(attendance.weekStart, "2026-11-02"));
    expect(weeks).toBeGreaterThan(40);

    const runs = await db
      .select()
      .from(pipelineRuns)
      .where(eq(pipelineRuns.source, "time-machine"));
    expect(runs).toHaveLength(14);
    expect(runs.reduce((sum, run) => sum + run.counts.uploadsRejected, 0)).toBe(0);
  });

  it("has simulated parents pay, but never the students in the guided story", async () => {
    const simulated = await db
      .select({ ref: payments.gatewayRef })
      .from(payments)
      .where(sql`${payments.gatewayRef} like 'SIM-%'`);
    expect(simulated.length).toBeGreaterThan(0);
    expect(simulated.some(({ ref }) => /STU-(0412|0587|0219)/.test(ref))).toBe(false);
  });

  it("keeps a silent student silent", async () => {
    const silent = await studentCalled("STU-1056");
    const rows = await db.select().from(attendance).where(eq(attendance.studentId, silent.id));
    expect(rows.every((row) => row.weekStart <= "2026-10-05")).toBe(true);
  });

  it("restores the moved date from the recorded runs after a restart", async () => {
    setDemoToday(null);
    await syncDemoClock();
    expect(today()).toBe("2026-11-16");
  });

  it("makes the same events for the same day", async () => {
    expect(await liveFeed("2026-11-22")).toEqual(await liveFeed("2026-11-22"));
  });

  it("puts everything back on reset", async () => {
    await resetDemo();
    expect(today()).toBe(SAMPLE_TODAY);
    const simulated = await db
      .select({ ref: payments.gatewayRef })
      .from(payments)
      .where(sql`${payments.gatewayRef} like 'SIM-%'`);
    expect(simulated).toHaveLength(0);
    expect((await storyLinks())?.paid).toBe(false);
  }, 60_000);
});
