import { eq, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db, sqlClient } from "@/db/client";
import {
  attendance,
  batches,
  centres,
  instalments,
  payments,
  reminders,
  riskFlags,
  students,
  testScores,
  users,
} from "@/db/schema";
import { addDays } from "@/domain/dates";
import { rupees } from "@/domain/money";
import { env } from "./env";
import { riskOf, runRiskCheck } from "./risk";

const TODAY = "2026-11-02";

let sent: string[];
let parentId: string;
let batchId: string;

/** The model's reply, for whichever students are sent. The network is never used. */
function geminiSays(band: string, confidence = "high") {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      const body = String(init.body);
      sent.push(body);
      const ids = [...new Set(body.match(/S\d+/g) ?? [])];
      const verdicts = ids.map((id) => ({
        id,
        band,
        confidence,
        signs: ["attendance"],
        why: "Attendance fell while the batch held steady.",
      }));
      return new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: JSON.stringify({ verdicts }) }] } }],
        }),
      );
    }),
  );
}

async function addStudent(code: string, shape: "mild-fall" | "strong-fall" | "steady" | "thin") {
  const [student] = await db
    .insert(students)
    .values({
      code,
      name: `Student ${code}`,
      batchId,
      parentId,
      planTotalPaise: rupees(30000),
      termStart: "2026-07-01",
      termEnd: "2027-06-30",
    })
    .returning();
  await db.insert(instalments).values({
    studentId: student.id,
    sequence: 1,
    dueDate: "2026-10-10",
    amountPaise: rupees(30000),
  });
  if (shape === "thin") return student;

  const total = 20;
  const late = { "mild-fall": 18, "strong-fall": 4, steady: 20 }[shape];
  await db.insert(attendance).values(
    Array.from({ length: 12 }, (_, index) => ({
      studentId: student.id,
      weekStart: addDays("2026-08-10", index * 7),
      present: index < 8 ? total : late,
      total,
    })),
  );
  await db.insert(testScores).values(
    Array.from({ length: 5 }, (_, index) => ({
      studentId: student.id,
      testName: `Test ${index}`,
      takenOn: addDays("2026-08-01", index * 14),
      score: 200,
      maxScore: 300,
    })),
  );
  return student;
}

const flagOf = async (studentId: string) =>
  (await db.select().from(riskFlags).where(eq(riskFlags.studentId, studentId)))[0];

beforeEach(async () => {
  sent = [];
  env.GEMINI_API_KEY = "test-key";
  await db.execute(
    sql`truncate table risk_flags, test_scores, attendance, payments, reminders, instalments, students, users, batches, centres cascade`,
  );
  const [centre] = await db.insert(centres).values({ name: "Centre 1" }).returning();
  const [batch] = await db
    .insert(batches)
    .values({ name: "JEE 2027 Morning", centreId: centre.id })
    .returning();
  batchId = batch.id;
  const [parent] = await db
    .insert(users)
    .values({ phone: "+919000000002", name: "Parent", role: "parent" })
    .returning();
  parentId = parent.id;
});

afterEach(() => {
  vi.unstubAllGlobals();
  env.GEMINI_API_KEY = undefined;
});

afterAll(async () => {
  await sqlClient.end();
});

describe("the AI gives the flag", () => {
  it("creates a task from the AI verdict, and records what the rule said", async () => {
    const student = await addStudent("STU-A", "strong-fall");
    geminiSays("high");
    await runRiskCheck(TODAY, { useAi: true });

    expect(await flagOf(student.id)).toMatchObject({
      band: "high",
      decidedBy: "ai",
      aiWhy: "Attendance fell while the batch held steady.",
      taskStatus: "open",
    });
  });

  it("can flag a student the rule would have passed", async () => {
    const student = await addStudent("STU-A", "mild-fall");
    await runRiskCheck(TODAY);
    expect(await flagOf(student.id)).toBeUndefined();

    geminiSays("watch");
    await runRiskCheck(TODAY, { useAi: true });
    expect(await flagOf(student.id)).toMatchObject({ decidedBy: "ai", ruleBand: null });
  });

  it("can clear a student the rule would have flagged", async () => {
    const student = await addStudent("STU-A", "strong-fall");
    geminiSays("none");
    await runRiskCheck(TODAY, { useAi: true });
    expect(await flagOf(student.id)).toBeUndefined();
  });

  it("does not remove an open task, and says the AI did not confirm it", async () => {
    const student = await addStudent("STU-A", "strong-fall");
    await runRiskCheck(TODAY);

    geminiSays("none");
    await runRiskCheck(TODAY, { useAi: true });
    expect(await flagOf(student.id)).toMatchObject({
      taskStatus: "open",
      decidedBy: "rules",
      aiWhy: "Attendance fell while the batch held steady.",
    });
  });

  it("sends no name, code or phone, and leaves out students with no sign or too little data", async () => {
    await addStudent("STU-A", "strong-fall");
    await addStudent("STU-B", "steady");
    await addStudent("STU-C", "thin");
    geminiSays("high");
    await runRiskCheck(TODAY, { useAi: true });

    expect(sent).toHaveLength(1);
    expect(sent[0]).not.toMatch(/STU-|Student STU|9000000002/);
    expect(sent[0].split("overdueInstalments\\\":").length - 1).toBe(1);
  });

  it("never flags on late fees alone, even when the model would", async () => {
    const student = await addStudent("STU-B", "steady");
    geminiSays("high");
    await runRiskCheck(TODAY, { useAi: true });
    expect(await flagOf(student.id)).toBeUndefined();
  });

  it("uses the rule when the model is unsure, offline or has no key", async () => {
    const student = await addStudent("STU-A", "strong-fall");
    geminiSays("high", "low");
    await runRiskCheck(TODAY, { useAi: true });
    expect(await flagOf(student.id)).toMatchObject({ decidedBy: "rules", band: "watch" });

    await db.delete(riskFlags);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await runRiskCheck(TODAY, { useAi: true });
    expect(await flagOf(student.id)).toMatchObject({ decidedBy: "rules", band: "watch" });

    await db.delete(riskFlags);
    env.GEMINI_API_KEY = undefined;
    await runRiskCheck(TODAY, { useAi: true });
    expect(await flagOf(student.id)).toMatchObject({ decidedBy: "rules", band: "watch" });
  });

  it("changes no fee, payment or reminder", async () => {
    await addStudent("STU-A", "strong-fall");
    const snapshot = async () => [
      await db.select().from(instalments),
      await db.select().from(payments),
      await db.select().from(reminders),
    ];
    const before = await snapshot();
    geminiSays("high");
    await runRiskCheck(TODAY, { useAi: true });
    expect(await snapshot()).toEqual(before);
  });

  it("shows the same band on the ledger as on the task", async () => {
    const student = await addStudent("STU-A", "strong-fall");
    geminiSays("high");
    await runRiskCheck(TODAY, { useAi: true });
    expect((await riskOf(student.id, TODAY)).band).toBe("high");
  });
});
