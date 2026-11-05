import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/cron/risk/route";
import { db, sqlClient } from "@/db/client";
import {
  attendance,
  batches,
  centres,
  consents,
  instalments,
  payments,
  refunds,
  reminders,
  riskFlags,
  students,
  testScores,
  users,
} from "@/db/schema";
import { addDays } from "@/domain/dates";
import { rupees } from "@/domain/money";
import { REFLAG_AFTER_DAYS } from "@/domain/risk";
import { env } from "./env";
import { recordPayment } from "./payments";
import { saveRefund } from "./refunds";
import { listTasks, reviewTask, riskOf, runRiskCheck } from "./risk";

const TODAY = "2026-11-02";

let parentId: string;
let staffId: string;
let batchId: string;

async function addStudent(code: string, shape: "falling" | "steady" | "thin") {
  const [student] = await db
    .insert(students)
    .values({
      code,
      name: code,
      batchId,
      parentId,
      planTotalPaise: rupees(60000),
      termStart: "2026-07-01",
      termEnd: "2027-06-30",
    })
    .returning();

  const [instalment] = await db
    .insert(instalments)
    .values({
      studentId: student.id,
      sequence: 1,
      dueDate: "2026-10-10",
      amountPaise: rupees(60000),
    })
    .returning();

  if (shape !== "thin") {
    await db.insert(attendance).values(
      Array.from({ length: 12 }, (_, index) => ({
        studentId: student.id,
        weekStart: addDays("2026-08-10", index * 7),
        present: shape === "falling" && index >= 8 ? 2 : 6,
        total: 6,
      })),
    );
    await db.insert(testScores).values(
      Array.from({ length: 6 }, (_, index) => ({
        studentId: student.id,
        testName: `Unit Test ${index + 1}`,
        takenOn: addDays("2026-07-25", index * 18),
        score: shape === "falling" && index >= 4 ? 30 : 70,
        maxScore: 100,
      })),
    );
  }

  return { student, instalment };
}

const flags = () => db.select().from(riskFlags);

beforeEach(async () => {
  await db.execute(
    sql`truncate table risk_flags, test_scores, attendance, refunds, reminders, payments, instalments, consents, students, users, batches, centres cascade`,
  );
  const [centre] = await db.insert(centres).values({ name: "Centre 1" }).returning();
  const [batch] = await db
    .insert(batches)
    .values({ name: "JEE 2027 Morning", centreId: centre.id })
    .returning();
  batchId = batch.id;
  const [parent, staff] = await db
    .insert(users)
    .values([
      { phone: "+919000000001", name: "Parent", role: "parent" as const },
      { phone: "+919000000100", name: "Staff", role: "accounts" as const },
    ])
    .returning();
  parentId = parent.id;
  staffId = staff.id;
});

afterAll(() => sqlClient.end());

describe("runRiskCheck", () => {
  it("creates one open task for a falling student, with reasons", async () => {
    const { student } = await addStudent("STU-A", "falling");

    expect(await runRiskCheck(TODAY)).toEqual({ checked: 1, flagged: 1, notEnoughData: 0 });

    const [flag] = await flags();
    expect(flag).toMatchObject({
      studentId: student.id,
      band: "high",
      taskStatus: "open",
      flaggedOn: TODAY,
    });
    expect(flag.reasons.map((reason) => reason.kind)).toEqual(["attendance", "tests", "missed"]);
  });

  it("creates nothing for a late fee with steady records", async () => {
    await addStudent("STU-B", "steady");

    expect((await runRiskCheck(TODAY)).flagged).toBe(0);
    expect(await flags()).toHaveLength(0);
  });

  it("creates no task with too little data, and counts it", async () => {
    await addStudent("STU-C", "thin");

    expect(await runRiskCheck(TODAY)).toEqual({ checked: 1, flagged: 0, notEnoughData: 1 });
    expect(await flags()).toHaveLength(0);
  });

  it("is safe to run again, and when two runs overlap", async () => {
    await addStudent("STU-A", "falling");

    await Promise.all([runRiskCheck(TODAY), runRiskCheck(TODAY)]);
    await runRiskCheck(TODAY);

    expect(await flags()).toHaveLength(1);
  });

  it("refreshes an open task as the data changes", async () => {
    const { student } = await addStudent("STU-A", "falling");
    await runRiskCheck(TODAY);

    await db
      .update(testScores)
      .set({ score: 70 })
      .where(eq(testScores.studentId, student.id));
    await runRiskCheck(TODAY);

    const [flag] = await flags();
    expect(flag.reasons.map((reason) => reason.kind)).toEqual(["attendance", "missed"]);
  });

  it("skips a student who has left", async () => {
    const { student } = await addStudent("STU-A", "falling");
    await saveRefund({ studentId: student.id, exitDate: "2026-10-12", createdBy: staffId }, TODAY);

    expect((await runRiskCheck(TODAY)).checked).toBe(0);
    expect(await flags()).toHaveLength(0);
  });

  it("leaves a reviewed student alone for a while, then flags them again", async () => {
    await addStudent("STU-A", "falling");
    await runRiskCheck(TODAY);
    const [flag] = await flags();
    await reviewTask(
      { taskId: flag.id, outcome: "false_flag", note: "On leave", reviewedBy: staffId },
      TODAY,
    );

    await runRiskCheck(addDays(TODAY, REFLAG_AFTER_DAYS - 1));
    expect(await flags()).toHaveLength(1);

    await runRiskCheck(addDays(TODAY, REFLAG_AFTER_DAYS));
    expect(await flags()).toHaveLength(2);
  });
});

describe("no side effects", () => {
  /** Everything a flag must never touch. risk_flags is deliberately left out. */
  const snapshot = async () => ({
    instalments: await db.select().from(instalments),
    payments: await db.select().from(payments),
    reminders: await db.select().from(reminders),
    refunds: await db.select().from(refunds),
    students: await db.select().from(students),
    consents: await db.select().from(consents),
    users: await db.select().from(users),
  });

  it("changes no fee, payment, reminder, refund or student record", async () => {
    const { instalment } = await addStudent("STU-A", "falling");
    await recordPayment({
      gatewayRef: "TEST-RISK-1",
      instalmentRef: instalment.id,
      amountPaise: rupees(1000),
      paidAt: "2026-10-05T06:00:00.000Z",
    });
    await db.insert(reminders).values({
      instalmentId: instalment.id,
      dayOffset: 3,
      language: "en",
      sendOn: "2026-11-20",
    });
    const before = await snapshot();

    await runRiskCheck(TODAY);
    const [flag] = await flags();
    await reviewTask({ taskId: flag.id, outcome: "called", note: null, reviewedBy: staffId }, TODAY);

    expect(await snapshot()).toEqual(before);
  });
});

describe("reviewTask", () => {
  const openTask = async () => {
    await addStudent("STU-A", "falling");
    await runRiskCheck(TODAY);
    return (await flags())[0].id;
  };

  it("records the outcome, the note and who reviewed it", async () => {
    const taskId = await openTask();

    const done = await reviewTask(
      { taskId, outcome: "false_flag", note: "Medical leave", reviewedBy: staffId },
      TODAY,
    );

    expect(done).toBe(true);
    expect((await flags())[0]).toMatchObject({
      taskStatus: "false_flag",
      reviewNote: "Medical leave",
      reviewedOn: TODAY,
      reviewedBy: staffId,
    });
  });

  it("cannot change a task that is already closed", async () => {
    const taskId = await openTask();
    await reviewTask({ taskId, outcome: "called", note: null, reviewedBy: staffId }, TODAY);

    const again = await reviewTask(
      { taskId, outcome: "false_flag", note: "Changed", reviewedBy: staffId },
      TODAY,
    );

    expect(again).toBe(false);
    expect((await flags())[0].taskStatus).toBe("called");
  });
});

describe("listTasks", () => {
  it("counts each status and puts high before watch", async () => {
    const high = await addStudent("STU-A", "falling");
    const watch = await addStudent("STU-B", "steady");
    await db.insert(riskFlags).values([
      { studentId: watch.student.id, band: "watch", reasons: [], flaggedOn: TODAY },
      { studentId: high.student.id, band: "high", reasons: [], flaggedOn: "2026-10-01" },
    ]);

    const { rows, counts } = await listTasks("open", 1);

    expect(rows.map((row) => row.band)).toEqual(["high", "watch"]);
    expect(counts).toEqual({ open: 2, called: 0, false_flag: 0 });
  });

  it("drops an open task once the student leaves", async () => {
    const { student } = await addStudent("STU-A", "falling");
    await runRiskCheck(TODAY);

    await saveRefund({ studentId: student.id, exitDate: "2026-10-12", createdBy: staffId }, TODAY);

    const { rows, counts } = await listTasks("open", 1);
    expect(rows).toHaveLength(0);
    expect(counts.open).toBe(0);
  });
});

describe("riskOf", () => {
  it("assesses one student without creating anything", async () => {
    const { student } = await addStudent("STU-A", "falling");

    expect((await riskOf(student.id, TODAY)).band).toBe("high");
    expect(await flags()).toHaveLength(0);
  });
});

describe("cron route", () => {
  const call = (authorization?: string) =>
    GET(
      new Request("http://localhost/api/cron/risk", {
        headers: authorization ? { authorization } : {},
      }),
    );

  it("refuses a call without the secret and runs nothing", async () => {
    await addStudent("STU-A", "falling");

    expect((await call()).status).toBe(401);
    expect((await call("Bearer wrong")).status).toBe(401);
    expect(await flags()).toHaveLength(0);
  });

  it("runs the check with the secret", async () => {
    await addStudent("STU-A", "falling");

    const response = await call(`Bearer ${env.CRON_SECRET}`);

    expect(response.status).toBe(200);
    expect(await flags()).toHaveLength(1);
  });
});
