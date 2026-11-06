import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET } from "@/app/api/cron/daily/route";
import { db, sqlClient } from "@/db/client";
import { loadSampleData } from "@/db/load-sample";
import { buildSampleData, SAMPLE_TODAY } from "@/db/sample-data";
import {
  instalments,
  payments,
  pipelineRuns,
  refunds,
  reminders,
  riskFlags,
  students,
} from "@/db/schema";
import { instalmentStatus } from "@/domain/instalments";
import { RULE_VERSION } from "@/domain/risk";
import { replayRule, summariseReplay } from "@/domain/risk-lab";
import { lateShare } from "@/domain/scoreboard";
import { latestClose, monthReport } from "./books";
import { istDate } from "./clock";
import { env } from "./env";
import { instalmentsOf } from "./ledger";
import { runDay } from "./pipeline";
import { labStudents } from "./risk-lab";
import { matchingHealth, reminderResponse, scoredInstalments } from "./scoreboard";

const studentCalled = async (code: string) =>
  (await db.select().from(students).where(eq(students.code, code)))[0];

const statusOf = async (code: string, sequence: number) => {
  const rows = await instalmentsOf((await studentCalled(code)).id);
  return instalmentStatus(rows[sequence - 1], SAMPLE_TODAY);
};

beforeAll(async () => {
  await loadSampleData();
}, 60_000);

afterAll(async () => {
  await sqlClient.end();
});

describe("the replayed term", () => {
  it("reproduces the three rows from the brief", async () => {
    expect(await statusOf("STU-0412", 2)).toEqual({ kind: "paid" });
    expect(await statusOf("STU-0587", 2)).toEqual({ kind: "overdue", days: 23, partPaid: true });
    expect(await statusOf("STU-0219", 2)).toEqual({ kind: "due", days: 13, partPaid: false });
  });

  it("issues real receipt numbers from one series", async () => {
    const rows = await db.select().from(payments).where(eq(payments.status, "matched"));
    const paid = buildSampleData().students.flatMap((s) => s.instalments.filter((i) => i.paidOn));
    // One counter entry is reversed in October, so it no longer counts as matched.
    expect(rows).toHaveLength(paid.length - 1);
    expect(rows.every((row) => /^RCT-\d{6}$/.test(row.receiptNo ?? ""))).toBe(true);
  });

  it("lets the matching rules fill the queue, each for its own reason", async () => {
    const queued = await db.select().from(payments).where(eq(payments.status, "unmatched"));
    expect(queued.map((row) => row.unmatchedReason).sort()).toEqual([
      "amount-too-high",
      "no-instalment",
      "student-left",
    ]);
  });

  it("had the daily job send reminders, and payments stop them", async () => {
    const counts = await db
      .select({ status: reminders.status, total: sql<number>`count(*)::int` })
      .from(reminders)
      .groupBy(reminders.status);
    const of = (status: string) => counts.find((row) => row.status === status)?.total ?? 0;
    expect(of("sent")).toBeGreaterThan(50);
    expect(of("stopped")).toBeGreaterThan(50);

    const [sent] = await db
      .select({ sentAt: reminders.sentAt, sendOn: reminders.sendOn })
      .from(reminders)
      .where(eq(reminders.status, "sent"));
    expect(istDate(sent.sentAt!)).toBe(sent.sendOn);
  });

  it("leaves the demo date's reminders for someone to run", async () => {
    const [{ due }] = await db
      .select({ due: sql<number>`count(*)::int` })
      .from(reminders)
      .where(sql`${reminders.status} = 'queued' and ${reminders.sendOn} <= ${SAMPLE_TODAY}`);
    expect(due).toBeGreaterThan(0);
  });

  it("flags the students built to trigger it, and leaves Ishita alone", async () => {
    const open = await db
      .select({ code: students.code })
      .from(riskFlags)
      .innerJoin(students, eq(students.id, riskFlags.studentId))
      .where(sql`${riskFlags.taskStatus} = 'open' and ${students.exitDate} is null`);
    const codes = open.map((row) => row.code);
    expect(codes).toEqual(expect.arrayContaining(["STU-1037", "STU-1038", "STU-1039"]));
    expect(codes).not.toContain("STU-0587");
    expect(codes).not.toContain("STU-1040");
  });

  it("closes the accounts of students who left through the refund code", async () => {
    const saved = await db.select().from(refunds);
    expect(saved).toHaveLength(6);
    expect(saved.filter((row) => row.refundPaise === 0)).toHaveLength(1);
  });

  it("records a run for every replayed day and rejects no file", async () => {
    const runs = await db.select().from(pipelineRuns);
    expect(runs.length).toBeGreaterThan(120);
    expect(runs.every((run) => run.source === "replay" && run.failed.length === 0)).toBe(true);
    expect(runs.reduce((sum, run) => sum + run.counts.uploadsRejected, 0)).toBe(0);
    expect(runs.reduce((sum, run) => sum + run.counts.recordsUploaded, 0)).toBeGreaterThan(500);
  });

  it("notices the student whose attendance simply stopped", async () => {
    const silent = await studentCalled("STU-1056");
    const [flag] = await db.select().from(riskFlags).where(eq(riskFlags.studentId, silent.id));
    expect(flag.reasons.map((reason) => reason.kind)).toContain("missing");
    expect(flag.ruleVersion).toBe(RULE_VERSION);
  });

  it("gives the risk lab real outcomes, with a leaver it missed", async () => {
    const before = await db.select({ total: sql<number>`count(*)::int` }).from(riskFlags);
    const { students: list, termStart } = await labStudents();
    const rows = replayRule(list, termStart, SAMPLE_TODAY);
    const summary = summariseReplay(rows);

    expect(summary.left).toBe(6);
    expect(summary.caught).toBeGreaterThanOrEqual(4);
    expect(summary.caught).toBeLessThan(6);
    expect(summary.averageWarning).toBeGreaterThan(0);
    expect(await db.select({ total: sql<number>`count(*)::int` }).from(riskFlags)).toEqual(before);
  });

  it("gives the scoreboard a real late figure, from payments that arrived late", async () => {
    const late = lateShare(await scoredInstalments(), SAMPLE_TODAY);
    expect(late.percent).toBeGreaterThan(0);
    expect(late.percent).toBeLessThan(50);

    const response = await reminderResponse();
    expect(response.sent).toBeGreaterThan(0);
    expect(response.followed).toBeLessThanOrEqual(response.sent);

    const health = await matchingHealth(SAMPLE_TODAY);
    expect(health.queued).toBe(3);
    expect(health.oldestDays).toBe(5);
  });

  it("closes the three finished months, and October cannot close with money queued", async () => {
    expect(await latestClose()).toEqual({ month: "2026-09", days: 1 });
    expect((await monthReport("2026-09")).close).not.toBeNull();

    const october = await monthReport("2026-10");
    expect(october.close).toBeNull();
    const failed = october.checks.filter((item) => !item.passed).map((item) => item.check);
    expect(failed).toEqual(["queue"]);
  });

  it("gives the same outcome when run twice", async () => {
    const snapshot = () =>
      db
        .select({ code: students.code, sequence: instalments.sequence, amount: payments.amountPaise })
        .from(payments)
        .innerJoin(instalments, eq(instalments.id, payments.instalmentId))
        .innerJoin(students, eq(students.id, instalments.studentId))
        .orderBy(students.code, instalments.sequence);

    const before = await snapshot();
    await loadSampleData();
    expect(await snapshot()).toEqual(before);
  }, 60_000);
});

describe("a live day", () => {
  it("runs the jobs and records the run", async () => {
    const { counts, failed } = await runDay(SAMPLE_TODAY, "staff");
    expect(failed).toEqual([]);
    expect(counts.remindersSent).toBeGreaterThan(0);
    const runs = await db.select().from(pipelineRuns).where(eq(pipelineRuns.source, "staff"));
    expect(runs).toHaveLength(1);
  });

  it("is safe to run twice on one day", async () => {
    const { counts } = await runDay(SAMPLE_TODAY, "staff");
    expect(counts.remindersSent).toBe(0);
    expect(counts.tasksCreated).toBe(0);
  });

  it("refuses a scheduler without the secret", async () => {
    const denied = await GET(new Request("http://test/api/cron/daily"));
    expect(denied.status).toBe(401);

    const allowed = await GET(
      new Request("http://test/api/cron/daily", {
        headers: { authorization: `Bearer ${env.CRON_SECRET}` },
      }),
    );
    expect(allowed.status).toBe(200);
  });
});
