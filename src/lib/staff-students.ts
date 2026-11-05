import { and, asc, count, eq, ilike, or } from "drizzle-orm";
import { db } from "@/db/client";
import { batches, centres, students, users } from "@/db/schema";
import { isUuid } from "./ledger";

export const STUDENTS_PER_PAGE = 25;

type Filters = { search: string; centreId: string | null; page: number };

const studentFields = {
  id: students.id,
  code: students.code,
  name: students.name,
  batch: batches.name,
  centre: centres.name,
  planTotal: students.planTotalPaise,
  discount: students.discountPaise,
  parentName: users.name,
  parentPhone: users.phone,
};

/** Stops % and _ in a search acting as wildcards. */
const likePattern = (text: string) => `%${text.replace(/[\\%_]/g, "\\$&")}%`;

export async function listStudents({ search, centreId, page }: Filters) {
  const pattern = likePattern(search);
  const where = and(
    centreId && isUuid(centreId) ? eq(centres.id, centreId) : undefined,
    search
      ? or(
          ilike(students.name, pattern),
          ilike(students.code, pattern),
          ilike(users.phone, pattern),
        )
      : undefined,
  );

  const [rows, totals] = await Promise.all([
    db
      .select(studentFields)
      .from(students)
      .innerJoin(batches, eq(batches.id, students.batchId))
      .innerJoin(centres, eq(centres.id, batches.centreId))
      .innerJoin(users, eq(users.id, students.parentId))
      .where(where)
      .orderBy(asc(students.name), asc(students.code))
      .limit(STUDENTS_PER_PAGE)
      .offset((page - 1) * STUDENTS_PER_PAGE),
    db
      .select({ total: count() })
      .from(students)
      .innerJoin(batches, eq(batches.id, students.batchId))
      .innerJoin(centres, eq(centres.id, batches.centreId))
      .innerJoin(users, eq(users.id, students.parentId))
      .where(where),
  ]);

  return { rows, total: totals[0].total };
}

export async function studentById(id: string) {
  if (!isUuid(id)) return null;

  const [row] = await db
    .select(studentFields)
    .from(students)
    .innerJoin(batches, eq(batches.id, students.batchId))
    .innerJoin(centres, eq(centres.id, batches.centreId))
    .innerJoin(users, eq(users.id, students.parentId))
    .where(eq(students.id, id));
  return row ?? null;
}

export const allCentres = () => db.select().from(centres).orderBy(asc(centres.name));
