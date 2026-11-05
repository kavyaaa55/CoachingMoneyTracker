import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
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
import { attendanceOf, scoresOf } from "./progress";
import { runRiskCheck } from "./risk";
import { batchStudents, inspectUpload, saveUpload } from "./upload";

const TODAY = "2026-11-02";
const ATTENDANCE = "Student ID,Week start,Present,Total";
const SCORES = "Student ID,Test name,Date,Score,Max score";

let batchId: string;
let otherBatchId: string;
let studentId: string;

const file = (...lines: string[]) => lines.join("\n");
const upload = (kind: "attendance" | "scores", text: string, batch = batchId) =>
  saveUpload({ kind, batchId: batch, text }, TODAY);
const inspect = (kind: "attendance" | "scores", text: string) =>
  inspectUpload({ kind, batchId, text }, TODAY);

async function addStudent(code: string, batch: string, parentId: string, exitDate?: string) {
  const [student] = await db
    .insert(students)
    .values({
      code,
      name: `Name of ${code}`,
      batchId: batch,
      parentId,
      planTotalPaise: rupees(60000),
      termStart: "2026-07-01",
      termEnd: "2027-06-30",
      exitDate,
    })
    .returning();
  return student;
}

beforeEach(async () => {
  await db.execute(
    sql`truncate table otp_codes, refunds, risk_flags, test_scores, attendance, reminders, payments,
        instalments, consents, students, users, batches, centres cascade`,
  );

  const [centre] = await db.insert(centres).values({ name: "Centre 1" }).returning();
  const [batch, other] = await db
    .insert(batches)
    .values([
      { name: "JEE 2027 Morning", centreId: centre.id },
      { name: "NEET 2027 Morning", centreId: centre.id },
    ])
    .returning();
  batchId = batch.id;
  otherBatchId = other.id;

  const [parent] = await db
    .insert(users)
    .values({ phone: "+919000000001", name: "Parent", role: "parent" })
    .returning();

  studentId = (await addStudent("STU-1", batchId, parent.id)).id;
  await addStudent("STU-2", otherBatchId, parent.id);
  await addStudent("STU-3", batchId, parent.id, "2026-10-01");
});

afterAll(async () => {
  await sqlClient.end();
});

describe("saveUpload", () => {
  it("saves attendance and test scores", async () => {
    expect(await upload("attendance", file(ATTENDANCE, "STU-1,2026-11-02,5,6"))).toEqual({
      saved: true,
      added: 1,
      changed: 0,
    });
    await upload("scores", file(SCORES, "STU-1,Unit Test 1,2026-11-01,180,300"));

    expect(await attendanceOf(studentId)).toEqual([
      { weekStart: "2026-11-02", present: 5, total: 6 },
    ]);
    expect(await scoresOf(studentId)).toEqual([
      { testName: "Unit Test 1", takenOn: "2026-11-01", score: 180, maxScore: 300 },
    ]);
  });

  it("saves nothing if any row is wrong", async () => {
    const result = await upload(
      "attendance",
      file(ATTENDANCE, "STU-1,2026-11-02,5,6", "STU-1,2026-10-26,9,6"),
    );

    expect(result).toEqual({ saved: false });
    expect(await db.select().from(attendance)).toEqual([]);
  });

  it("refuses a student from another batch", async () => {
    const inspection = await inspect("attendance", file(ATTENDANCE, "STU-2,2026-11-02,5,6"));
    expect(inspection.errors).toEqual([{ line: 2, problem: "not-in-batch", value: "STU-2" }]);
    expect(await upload("attendance", file(ATTENDANCE, "STU-2,2026-11-02,5,6"))).toEqual({
      saved: false,
    });
  });

  it("refuses a batch that does not exist", async () => {
    const text = file(ATTENDANCE, "STU-1,2026-11-02,5,6");
    expect(await upload("attendance", text, "not-a-batch")).toEqual({ saved: false });
  });

  it("does nothing on a repeat upload", async () => {
    const text = file(ATTENDANCE, "STU-1,2026-11-02,5,6");
    await upload("attendance", text);

    expect(await upload("attendance", text)).toEqual({ saved: true, added: 0, changed: 0 });
    expect(await db.select().from(attendance)).toHaveLength(1);
  });

  it("replaces a corrected record instead of adding a second one", async () => {
    await upload("attendance", file(ATTENDANCE, "STU-1,2026-11-02,5,6"));

    const corrected = file(ATTENDANCE, "STU-1,2026-11-02,3,6");
    const inspection = await inspect("attendance", corrected);
    expect(inspection.changes[0].status).toBe("changed");
    expect(inspection.changes[0].before).toMatchObject({ present: 5 });

    expect(await upload("attendance", corrected)).toEqual({ saved: true, added: 0, changed: 1 });
    expect(await attendanceOf(studentId)).toEqual([
      { weekStart: "2026-11-02", present: 3, total: 6 },
    ]);
  });

  it("replaces a corrected test score, including its date", async () => {
    await upload("scores", file(SCORES, "STU-1,Unit Test 1,2026-10-01,180,300"));
    await upload("scores", file(SCORES, "STU-1,Unit Test 1,2026-10-02,200,300"));

    expect(await scoresOf(studentId)).toEqual([
      { testName: "Unit Test 1", takenOn: "2026-10-02", score: 200, maxScore: 300 },
    ]);
  });

  it("refuses a date after a student left", async () => {
    const inspection = await inspect("attendance", file(ATTENDANCE, "STU-3,2026-11-02,5,6"));
    expect(inspection.errors[0].problem).toBe("after-exit");
  });

  it("changes no fee, reminder or call task, and sends no message", async () => {
    const [instalment] = await db
      .insert(instalments)
      .values({ studentId, sequence: 1, dueDate: "2026-10-10", amountPaise: rupees(60000) })
      .returning();
    await db.insert(reminders).values({
      instalmentId: instalment.id,
      dayOffset: 28,
      language: "en",
      sendOn: "2026-11-07",
    });

    const before = await Promise.all([
      db.select().from(instalments),
      db.select().from(payments),
      db.select().from(reminders),
      db.select().from(riskFlags),
    ]);

    await upload("attendance", file(ATTENDANCE, "STU-1,2026-11-02,0,6"));

    expect(
      await Promise.all([
        db.select().from(instalments),
        db.select().from(payments),
        db.select().from(reminders),
        db.select().from(riskFlags),
      ]),
    ).toEqual(before);
  });

  it("feeds the risk check on its next run", async () => {
    await db.insert(instalments).values({
      studentId,
      sequence: 1,
      dueDate: "2026-10-10",
      amountPaise: rupees(60000),
    });
    await db.insert(attendance).values(
      Array.from({ length: 8 }, (_, index) => ({
        studentId,
        weekStart: addDays("2026-08-10", index * 7),
        present: 6,
        total: 6,
      })),
    );
    await db.insert(testScores).values(
      Array.from({ length: 6 }, (_, index) => ({
        studentId,
        testName: `Unit Test ${index + 1}`,
        takenOn: addDays("2026-07-25", index * 18),
        score: 200,
        maxScore: 300,
      })),
    );

    await runRiskCheck(TODAY);
    expect(await db.select().from(riskFlags)).toEqual([]);

    const weeks = ["2026-10-12", "2026-10-19", "2026-10-26", "2026-11-02"];
    await upload("attendance", file(ATTENDANCE, ...weeks.map((week) => `STU-1,${week},2,6`)));
    expect(await db.select().from(riskFlags)).toEqual([]);

    await runRiskCheck(TODAY);
    const flags = await db.select().from(riskFlags).where(eq(riskFlags.studentId, studentId));
    expect(flags).toHaveLength(1);
    expect(flags[0].reasons).toContainEqual({ kind: "attendance", from: 100, to: 33 });
  });
});

describe("batchStudents", () => {
  it("lists one batch only", async () => {
    expect((await batchStudents(batchId)).map((student) => student.code)).toEqual([
      "STU-1",
      "STU-3",
    ]);
    expect(await batchStudents("not-a-batch")).toEqual([]);
  });
});

describe("attendanceOf and scoresOf", () => {
  it("show the latest first, up to the limit", async () => {
    await db.insert(attendance).values(
      Array.from({ length: 14 }, (_, index) => ({
        studentId,
        weekStart: addDays("2026-08-03", index * 7),
        present: 5,
        total: 6,
      })),
    );

    const rows = await attendanceOf(studentId);
    expect(rows).toHaveLength(12);
    expect(rows[0].weekStart).toBe("2026-11-02");
  });
});
