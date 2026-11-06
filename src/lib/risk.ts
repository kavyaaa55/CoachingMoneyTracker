import { and, asc, count, desc, eq, inArray, isNull, max, ne, or } from "drizzle-orm";
import { db } from "@/db/client";
import {
  attendance,
  batches,
  centres,
  riskFlags,
  students,
  testScores,
  users,
} from "@/db/schema";
import type { IsoDate } from "@/domain/dates";
import { assessRisk, decideTask, latestWeekByBatch, RULE_VERSION } from "@/domain/risk";
import { audit } from "./audit";
import { today } from "./clock";
import { instalmentsOf, instalmentsOfMany } from "./ledger";

export const TASKS_PER_PAGE = 25;

export type RiskRunResult = { checked: number; flagged: number; notEnoughData: number };

const groupBy = <T extends { studentId: string }>(rows: T[]) => {
  const groups = new Map<string, T[]>();
  for (const row of rows) groups.set(row.studentId, [...(groups.get(row.studentId) ?? []), row]);
  return groups;
};

/**
 * The daily job, used by the cron route and the "Run risk check" button. The hard rule from
 * the brief lives here: it reads fee records, but the only table it ever writes is risk_flags.
 */
export async function runRiskCheck(date: IsoDate = today()): Promise<RiskRunResult> {
  const active = await db
    .select({ id: students.id, batchId: students.batchId })
    .from(students)
    .where(isNull(students.exitDate));
  const ids = active.map((student) => student.id);
  if (ids.length === 0) return { checked: 0, flagged: 0, notEnoughData: 0 };

  const [instalmentRows, attendanceRows, scoreRows, flagRows] = await Promise.all([
    instalmentsOfMany(ids),
    db.select().from(attendance).where(inArray(attendance.studentId, ids)),
    db.select().from(testScores).where(inArray(testScores.studentId, ids)),
    db.select().from(riskFlags).where(inArray(riskFlags.studentId, ids)),
  ]);
  const instalmentsBy = groupBy(instalmentRows);
  const attendanceBy = groupBy(attendanceRows);
  const scoresBy = groupBy(scoreRows);
  const flagsBy = groupBy(flagRows);

  const batchOf = new Map(active.map((student) => [student.id, student.batchId]));
  const latestWeeks = latestWeekByBatch(
    attendanceRows.map((row) => ({
      batchId: batchOf.get(row.studentId)!,
      weekStart: row.weekStart,
    })),
  );

  const result: RiskRunResult = { checked: ids.length, flagged: 0, notEnoughData: 0 };

  for (const studentId of ids) {
    const risk = assessRisk({
      instalments: instalmentsBy.get(studentId) ?? [],
      attendance: attendanceBy.get(studentId) ?? [],
      scores: scoresBy.get(studentId) ?? [],
      today: date,
      batchLatestWeek: latestWeeks.get(batchOf.get(studentId)!),
    });
    if (risk.band === "not-enough-data") result.notEnoughData += 1;

    const flags = flagsBy.get(studentId) ?? [];
    const open = flags.find((flag) => flag.taskStatus === "open");
    const lastReviewedOn =
      flags
        .flatMap((flag) => flag.reviewedOn ?? [])
        .sort()
        .at(-1) ?? null;

    const action = decideTask(risk, { hasOpenTask: Boolean(open), lastReviewedOn }, date);
    if (action === "skip" || (risk.band !== "watch" && risk.band !== "high")) continue;

    if (action === "update" && open) {
      await db
        .update(riskFlags)
        .set({ band: risk.band, reasons: risk.reasons, ruleVersion: RULE_VERSION })
        .where(eq(riskFlags.id, open.id));
    } else {
      const created = await db
        .insert(riskFlags)
        .values({
          studentId,
          band: risk.band,
          reasons: risk.reasons,
          flaggedOn: date,
          ruleVersion: RULE_VERSION,
        })
        .onConflictDoNothing()
        .returning({ id: riskFlags.id });
      result.flagged += created.length;
    }
  }

  return result;
}

/** Live assessment for one student, shown to staff on the ledger. */
export async function riskOf(studentId: string, date: IsoDate = today()) {
  const [instalments, attendanceRows, scores, [batch]] = await Promise.all([
    instalmentsOf(studentId),
    db.select().from(attendance).where(eq(attendance.studentId, studentId)),
    db.select().from(testScores).where(eq(testScores.studentId, studentId)),
    db
      .select({ latest: max(attendance.weekStart) })
      .from(attendance)
      .innerJoin(students, eq(students.id, attendance.studentId))
      .where(
        eq(
          students.batchId,
          db.select({ id: students.batchId }).from(students).where(eq(students.id, studentId)),
        ),
      ),
  ]);
  return assessRisk({
    instalments,
    attendance: attendanceRows,
    scores,
    today: date,
    batchLatestWeek: batch?.latest,
  });
}

export const TASK_FILTERS = ["open", "called", "false_flag"] as const;
export type TaskFilter = (typeof TASK_FILTERS)[number];

/** A student who has left needs no call, so their open task drops off the list. */
const stillRelevant = or(ne(riskFlags.taskStatus, "open"), isNull(students.exitDate));

export async function listTasks(filter: TaskFilter, page: number) {
  const [rows, totals] = await Promise.all([
    db
      .select({
        id: riskFlags.id,
        studentId: students.id,
        studentName: students.name,
        studentCode: students.code,
        batch: batches.name,
        centre: centres.name,
        parentName: users.name,
        parentPhone: users.phone,
        parentLanguage: users.language,
        band: riskFlags.band,
        reasons: riskFlags.reasons,
        status: riskFlags.taskStatus,
        note: riskFlags.reviewNote,
        flaggedOn: riskFlags.flaggedOn,
        reviewedOn: riskFlags.reviewedOn,
      })
      .from(riskFlags)
      .innerJoin(students, eq(students.id, riskFlags.studentId))
      .innerJoin(batches, eq(batches.id, students.batchId))
      .innerJoin(centres, eq(centres.id, batches.centreId))
      .innerJoin(users, eq(users.id, students.parentId))
      .where(and(eq(riskFlags.taskStatus, filter), stillRelevant))
      .orderBy(desc(riskFlags.band), desc(riskFlags.flaggedOn), asc(students.name))
      .limit(TASKS_PER_PAGE)
      .offset((page - 1) * TASKS_PER_PAGE),
    db
      .select({ status: riskFlags.taskStatus, total: count() })
      .from(riskFlags)
      .innerJoin(students, eq(students.id, riskFlags.studentId))
      .where(stillRelevant)
      .groupBy(riskFlags.taskStatus),
  ]);

  const counts = { open: 0, called: 0, false_flag: 0 };
  for (const { status, total } of totals) counts[status] = total;

  return { rows, counts };
}

type Review = {
  taskId: string;
  outcome: "called" | "false_flag";
  note: string | null;
  reviewedBy: string;
};

/** Closes a call task and changes nothing else. A second click finds it closed and stops. */
export async function reviewTask(
  { taskId, outcome, note, reviewedBy }: Review,
  date: IsoDate = today(),
) {
  const updated = await db
    .update(riskFlags)
    .set({ taskStatus: outcome, reviewNote: note, reviewedOn: date, reviewedBy })
    .where(and(eq(riskFlags.id, taskId), eq(riskFlags.taskStatus, "open")))
    .returning({ id: riskFlags.id });

  if (updated.length > 0) {
    await audit(db, {
      actorId: reviewedBy,
      action: "task.reviewed",
      entityId: taskId,
      detail: { outcome, note },
    });
  }
  return updated.length > 0;
}
