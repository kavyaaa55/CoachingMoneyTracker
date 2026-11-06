import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/health/route";
import { db, sqlClient } from "@/db/client";
import {
  batches,
  centres,
  instalments,
  otpCodes,
  pipelineRuns,
  rateLimits,
  reminders,
  students,
  users,
} from "@/db/schema";
import { rupees } from "@/domain/money";
import { runDay } from "./pipeline";
import { forgetOldLimits, withinLimit } from "./rate-limit";
import { runReminders, type Sender } from "./reminders";

const TODAY = "2026-11-02";

async function addStudentsWithDues(total: number) {
  const [centre] = await db.insert(centres).values({ name: "Centre 1" }).returning();
  const [batch] = await db
    .insert(batches)
    .values({ name: "JEE 2027 Morning", centreId: centre.id })
    .returning();
  const parents = await db
    .insert(users)
    .values(
      Array.from({ length: total }, (_, index) => ({
        phone: `+9180000${String(index).padStart(5, "0")}`,
        name: `Parent ${index}`,
        role: "parent" as const,
      })),
    )
    .returning();
  const rows = await db
    .insert(students)
    .values(
      parents.map((parent, index) => ({
        code: `STU-${index}`,
        name: `Student ${index}`,
        batchId: batch.id,
        parentId: parent.id,
        planTotalPaise: rupees(30000),
        termStart: "2026-07-01",
        termEnd: "2027-06-30",
      })),
    )
    .returning();
  await db.insert(instalments).values(
    rows.map((student) => ({
      studentId: student.id,
      sequence: 1,
      dueDate: TODAY,
      amountPaise: rupees(30000),
    })),
  );
}

beforeEach(async () => {
  await db.execute(
    sql`truncate table rate_limits, otp_codes, pipeline_runs, reminders, instalments, students, users, batches, centres cascade`,
  );
});

afterAll(async () => {
  await sqlClient.end();
});

describe("the daily pipeline", () => {
  it("refuses to run twice at once, so two servers cannot double the work", async () => {
    const results = await Promise.all([runDay(TODAY, "staff"), runDay(TODAY, "staff")]);
    expect(results.filter((run) => run.skipped)).toHaveLength(1);
    expect(await db.select().from(pipelineRuns)).toHaveLength(1);
  });

  it("releases the lock, so the next run goes ahead", async () => {
    await runDay(TODAY, "staff");
    expect((await runDay(TODAY, "staff")).skipped).toBe(false);
  });

  it("clears out expired sign-in codes and old rate limits", async () => {
    const old = new Date("2020-01-01T00:00:00Z");
    await db.insert(otpCodes).values({ phone: "+919", codeHash: "x", expiresAt: old, createdAt: old });
    await db.insert(rateLimits).values({ key: "ip:1", windowStart: old, hits: 1 });
    await runDay(TODAY, "staff");
    expect(await db.select().from(otpCodes)).toHaveLength(0);
    expect(await db.select().from(rateLimits)).toHaveLength(0);
  });
});

describe("sending reminders", () => {
  it("sends in parallel, but sends each reminder exactly once", async () => {
    await addStudentsWithDues(20);
    let inFlight = 0;
    let peak = 0;
    const sent: string[] = [];
    const send: Sender = async ({ phone }) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 20));
      sent.push(phone);
      inFlight -= 1;
    };

    const result = await runReminders(TODAY, send);
    expect(result.sent).toBe(20);
    expect(new Set(sent).size).toBe(20);
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThanOrEqual(8);
  });

  it("gives up on a provider that hangs, and leaves the reminder to retry", async () => {
    await addStudentsWithDues(1);
    const hangs: Sender = () => new Promise(() => {});

    const result = await runReminders(TODAY, hangs, 50);
    expect(result).toMatchObject({ sent: 0, failed: 1 });
    const rows = await db.select().from(reminders);
    expect(rows.some((row) => row.status === "queued")).toBe(true);
  }, 10_000);
});

describe("the limit per address", () => {
  const limit = { requests: 3, windowMs: 60_000 };
  const now = new Date("2026-11-02T06:00:00Z");

  it("allows up to the limit, then refuses", async () => {
    const hits = [];
    for (let index = 0; index < 5; index += 1) hits.push(await withinLimit("ip:a", limit, now));
    expect(hits).toEqual([true, true, true, false, false]);
  });

  it("holds under parallel requests", async () => {
    const hits = await Promise.all(
      Array.from({ length: 20 }, () => withinLimit("ip:b", limit, now)),
    );
    expect(hits.filter(Boolean)).toHaveLength(3);
  });

  it("starts again after the window, and keeps addresses apart", async () => {
    for (let index = 0; index < 4; index += 1) await withinLimit("ip:c", limit, now);
    expect(await withinLimit("ip:c", limit, new Date(now.getTime() + 61_000))).toBe(true);
    expect(await withinLimit("ip:d", limit, now)).toBe(true);
  });

  it("forgets old entries", async () => {
    await withinLimit("ip:e", limit, new Date("2020-01-01T00:00:00Z"));
    await forgetOldLimits(now);
    expect(await db.select().from(rateLimits)).toHaveLength(0);
  });
});

describe("the health check", () => {
  it("reports the database is reachable and shares no personal data", async () => {
    await runDay(TODAY, "staff");
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok", lastPipelineRun: TODAY });
  });
});
