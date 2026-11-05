import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { attendance, testScores } from "@/db/schema";

/** Enough for a phone screen. Older records stay saved. */
export const PROGRESS_LIMIT = 12;

/** Callers must have checked the student belongs to the signed-in parent. */
export function attendanceOf(studentId: string) {
  return db
    .select({
      weekStart: attendance.weekStart,
      present: attendance.present,
      total: attendance.total,
    })
    .from(attendance)
    .where(eq(attendance.studentId, studentId))
    .orderBy(desc(attendance.weekStart))
    .limit(PROGRESS_LIMIT);
}

export function scoresOf(studentId: string) {
  return db
    .select({
      testName: testScores.testName,
      takenOn: testScores.takenOn,
      score: testScores.score,
      maxScore: testScores.maxScore,
    })
    .from(testScores)
    .where(eq(testScores.studentId, studentId))
    .orderBy(desc(testScores.takenOn), desc(testScores.testName))
    .limit(PROGRESS_LIMIT);
}
