import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db, sqlClient } from "@/db/client";
import { batches, centres, students, users } from "@/db/schema";
import { rupees } from "@/domain/money";
import { listStudents, STUDENTS_PER_PAGE, studentById } from "./staff-students";

let centreTwo: string;
let firstStudent: string;

const list = (search = "", centreId: string | null = null, page = 1) =>
  listStudents({ search, centreId, page });

beforeAll(async () => {
  await db.execute(
    sql`truncate table payments, instalments, students, users, batches, centres cascade`,
  );
  const [one, two] = await db
    .insert(centres)
    .values([{ name: "Centre 1" }, { name: "Centre 2" }])
    .returning();
  centreTwo = two.id;
  const [batchOne, batchTwo] = await db
    .insert(batches)
    .values([
      { name: "JEE 2027 Morning", centreId: one.id },
      { name: "NEET 2027 Morning", centreId: two.id },
    ])
    .returning();

  const total = STUDENTS_PER_PAGE + 5;
  const parents = await db
    .insert(users)
    .values(
      Array.from({ length: total }, (_, index) => ({
        phone: `+9190000${String(10000 + index)}`,
        name: `Parent ${index}`,
        role: "parent" as const,
      })),
    )
    .returning();

  const rows = await db
    .insert(students)
    .values(
      parents.map((parent, index) => ({
        code: `STU-${1000 + index}`,
        name: index === 0 ? "Ishita Sharma" : `Student ${String(index).padStart(2, "0")}`,
        batchId: index % 2 === 0 ? batchOne.id : batchTwo.id,
        parentId: parent.id,
        planTotalPaise: rupees(120000),
        termStart: "2026-07-01",
        termEnd: "2027-06-30",
      })),
    )
    .returning();
  firstStudent = rows[0].id;
});

afterAll(() => sqlClient.end());

describe("listStudents", () => {
  it("finds by name, ignoring case", async () => {
    const { rows, total } = await list("ishita");
    expect(total).toBe(1);
    expect(rows[0].code).toBe("STU-1000");
  });

  it("finds by student ID and by phone", async () => {
    expect((await list("STU-1003")).rows[0].code).toBe("STU-1003");
    expect((await list("9000010004")).rows[0].code).toBe("STU-1004");
  });

  it("returns nothing for no match", async () => {
    expect(await list("zzzz")).toEqual({ rows: [], total: 0 });
  });

  it("treats wildcards as plain text", async () => {
    expect((await list("%")).total).toBe(0);
    expect((await list("_")).total).toBe(0);
  });

  it("filters by centre", async () => {
    const { rows } = await list("", centreTwo);
    expect(rows.every((row) => row.centre === "Centre 2")).toBe(true);
  });

  it("ignores a centre filter that is not valid", async () => {
    expect((await list("", "not-a-uuid")).total).toBe(STUDENTS_PER_PAGE + 5);
  });

  it("splits results into pages", async () => {
    const first = await list("", null, 1);
    const second = await list("", null, 2);

    expect(first.rows).toHaveLength(STUDENTS_PER_PAGE);
    expect(second.rows).toHaveLength(5);
    expect(first.total).toBe(STUDENTS_PER_PAGE + 5);
  });
});

describe("studentById", () => {
  it("returns the student with parent details", async () => {
    expect(await studentById(firstStudent)).toMatchObject({
      name: "Ishita Sharma",
      batch: "JEE 2027 Morning",
      parentName: "Parent 0",
    });
  });

  it("returns null for a bad or unknown id", async () => {
    expect(await studentById("not-a-uuid")).toBeNull();
    expect(await studentById("00000000-0000-4000-8000-000000000000")).toBeNull();
  });
});
