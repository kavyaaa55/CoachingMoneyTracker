import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { batches, centres, consents, students } from "@/db/schema";
import { CONSENT_NOTICE_VERSION } from "@/domain/access";

export function childrenOf(parentId: string) {
  return db
    .select({
      id: students.id,
      name: students.name,
      batch: batches.name,
      centre: centres.name,
      exitDate: students.exitDate,
    })
    .from(students)
    .innerJoin(batches, eq(batches.id, students.batchId))
    .innerJoin(centres, eq(centres.id, batches.centreId))
    .where(eq(students.parentId, parentId))
    .orderBy(students.name);
}

export async function hasLeft(studentId: string): Promise<boolean> {
  const [row] = await db
    .select({ exitDate: students.exitDate })
    .from(students)
    .where(eq(students.id, studentId));
  return Boolean(row?.exitDate);
}

export async function consentedStudentIds(parentId: string): Promise<string[]> {
  const rows = await db
    .select({ studentId: consents.studentId })
    .from(consents)
    .where(
      and(eq(consents.parentId, parentId), eq(consents.noticeVersion, CONSENT_NOTICE_VERSION)),
    );
  return rows.map((row) => row.studentId);
}
