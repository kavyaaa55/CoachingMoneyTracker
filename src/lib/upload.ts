import { asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { attendance, batches, centres, students, testScores } from "@/db/schema";
import type { IsoDate } from "@/domain/dates";
import {
  attendanceKey,
  compareWithSaved,
  readAttendance,
  readScores,
  scoreKey,
  type AttendanceRecord,
  type Change,
  type ScoreRecord,
  type UploadError,
  type UploadKind,
  type UploadStudent,
} from "@/domain/upload";
import { audit } from "./audit";
import { today } from "./clock";
import { isUuid } from "./ledger";

export function batchChoices() {
  return db
    .select({ id: batches.id, name: batches.name, centre: centres.name })
    .from(batches)
    .innerJoin(centres, eq(centres.id, batches.centreId))
    .orderBy(asc(centres.name), asc(batches.name));
}

export async function batchStudents(batchId: string): Promise<UploadStudent[]> {
  if (!isUuid(batchId)) return [];

  return db
    .select({
      id: students.id,
      code: students.code,
      name: students.name,
      termStart: students.termStart,
      exitDate: students.exitDate,
    })
    .from(students)
    .where(eq(students.batchId, batchId))
    .orderBy(asc(students.name));
}

type Common = { blank: number; errors: UploadError[]; students: UploadStudent[] };

export type Inspection =
  | (Common & { kind: "attendance"; changes: Change<AttendanceRecord>[] })
  | (Common & { kind: "scores"; changes: Change<ScoreRecord>[] });

type UploadInput = { kind: UploadKind; batchId: string; text: string };

/** Reads a file against one batch and compares it with what is saved. Writes nothing. */
export async function inspectUpload(
  { kind, batchId, text }: UploadInput,
  date: IsoDate = today(),
): Promise<Inspection> {
  const batch = await batchStudents(batchId);
  const context = { students: batch, today: date };
  const ids = batch.map((student) => student.id);

  if (kind === "attendance") {
    const { records, blank, errors } = readAttendance(text, context);
    const saved = await db
      .select({
        studentId: attendance.studentId,
        weekStart: attendance.weekStart,
        present: attendance.present,
        total: attendance.total,
      })
      .from(attendance)
      .where(inArray(attendance.studentId, ids));

    const changes = compareWithSaved(
      records,
      saved,
      attendanceKey,
      (a, b) => a.present === b.present && a.total === b.total,
    );
    return { kind, changes, blank, errors, students: batch };
  }

  const { records, blank, errors } = readScores(text, context);
  const saved = await db
    .select({
      studentId: testScores.studentId,
      testName: testScores.testName,
      takenOn: testScores.takenOn,
      score: testScores.score,
      maxScore: testScores.maxScore,
    })
    .from(testScores)
    .where(inArray(testScores.studentId, ids));

  const changes = compareWithSaved(
    records,
    saved,
    scoreKey,
    (a, b) => a.takenOn === b.takenOn && a.score === b.score && a.maxScore === b.maxScore,
  );
  return { kind, changes, blank, errors, students: batch };
}

export type SaveOutcome = { saved: false } | { saved: true; added: number; changed: number };

/**
 * Checks the file again, because the screen that showed it proves nothing. One statement
 * saves every row or none. This only ever writes attendance and test scores: the risk
 * check reads them on its own schedule, and no fee or parent message follows from here.
 */
export async function saveUpload(
  input: UploadInput,
  date: IsoDate = today(),
  actorId?: string,
): Promise<SaveOutcome> {
  const inspection = await inspectUpload(input, date);
  if (inspection.errors.length > 0) return { saved: false };

  const count = (status: string) =>
    inspection.changes.filter((change) => change.status === status).length;
  const outcome = { saved: true, added: count("new"), changed: count("changed") } as const;
  if (outcome.added + outcome.changed === 0) return outcome;

  if (inspection.kind === "attendance") {
    await db
      .insert(attendance)
      .values(inspection.changes.filter((c) => c.status !== "same").map((c) => c.record))
      .onConflictDoUpdate({
        target: [attendance.studentId, attendance.weekStart],
        set: { present: sql`excluded.present`, total: sql`excluded.total` },
      });
  } else {
    await db
      .insert(testScores)
      .values(inspection.changes.filter((c) => c.status !== "same").map((c) => c.record))
      .onConflictDoUpdate({
        target: [testScores.studentId, testScores.testName],
        set: {
          takenOn: sql`excluded.taken_on`,
          score: sql`excluded.score`,
          maxScore: sql`excluded.max_score`,
        },
      });
  }

  // Replaced values are kept here, so a correction can always be traced.
  if (actorId && outcome.changed > 0) {
    const replaced = inspection.changes.filter((change) => change.status === "changed");
    await audit(db, {
      actorId,
      action: "upload.saved",
      entityId: input.batchId,
      detail: {
        kind: inspection.kind,
        added: outcome.added,
        changed: outcome.changed,
        replaced: replaced.slice(0, 20).map(({ before, record }) => ({ before, after: record })),
      },
    });
  }

  return outcome;
}
