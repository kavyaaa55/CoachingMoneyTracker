import { sql } from "drizzle-orm";
import { rupees } from "@/domain/money";
import { db, sqlClient } from "./client";
import { buildSampleData, CENTRES, PLAN_TOTAL } from "./sample-data";
import {
  attendance,
  batches,
  centres,
  instalments,
  payments,
  students,
  testScores,
  users,
} from "./schema";

const TERM = { termStart: "2026-07-01", termEnd: "2027-06-30" };
const paidAt = (date: string) => new Date(`${date}T06:00:00Z`);

async function seed() {
  const sample = buildSampleData();

  await db.transaction(async (tx) => {
    await tx.execute(
      sql`truncate table refunds, risk_flags, test_scores, attendance, reminders, payments,
          instalments, consents, students, users, batches, centres cascade`,
    );

    const centreRows = await tx
      .insert(centres)
      .values(CENTRES.map((name) => ({ name })))
      .returning();
    const centreId = new Map(centreRows.map((row) => [row.name, row.id]));

    const batchKeys = [...new Set(sample.students.map((s) => `${s.centre}|${s.batch}`))];
    const batchRows = await tx
      .insert(batches)
      .values(
        batchKeys.map((key) => {
          const [centre, name] = key.split("|");
          return { name, centreId: centreId.get(centre)! };
        }),
      )
      .returning();
    const centreName = new Map(centreRows.map((row) => [row.id, row.name]));
    const batchId = new Map(
      batchRows.map((row) => [`${centreName.get(row.centreId)}|${row.name}`, row.id]),
    );

    await tx.insert(users).values({
      phone: "+919000000100",
      name: "Accounts Executive",
      role: "accounts",
    });

    const parents = new Map(sample.students.map((s) => [s.parentPhone, s]));
    const parentRows = await tx
      .insert(users)
      .values(
        [...parents.values()].map((s) => ({
          phone: s.parentPhone,
          name: s.parentName,
          role: "parent" as const,
          language: s.language,
        })),
      )
      .returning();
    const parentId = new Map(parentRows.map((row) => [row.phone, row.id]));

    const studentRows = await tx
      .insert(students)
      .values(
        sample.students.map((s) => ({
          ...TERM,
          code: s.code,
          name: s.name,
          batchId: batchId.get(`${s.centre}|${s.batch}`)!,
          parentId: parentId.get(s.parentPhone)!,
          planTotalPaise: rupees(PLAN_TOTAL),
          discountPaise: rupees(s.discount),
        })),
      )
      .returning();
    const studentId = new Map(studentRows.map((row) => [row.code, row.id]));

    const instalmentRows = await tx
      .insert(instalments)
      .values(
        sample.students.flatMap((s) =>
          s.instalments.map((item, index) => ({
            studentId: studentId.get(s.code)!,
            sequence: index + 1,
            dueDate: item.dueDate,
            amountPaise: rupees(item.amount),
          })),
        ),
      )
      .returning();
    const instalmentId = new Map(
      instalmentRows.map((row) => [`${row.studentId}|${row.sequence}`, row.id]),
    );

    const matchedPayments = sample.students.flatMap((s) =>
      s.instalments.flatMap((item, index) => {
        if (item.paid === 0 || !item.paidOn) return [];
        const reference = `${s.code}-${index + 1}`;
        return [
          {
            gatewayRef: `SEED-${reference}`,
            instalmentId: instalmentId.get(`${studentId.get(s.code)}|${index + 1}`)!,
            amountPaise: rupees(item.paid),
            status: "matched" as const,
            receiptNo: `RCT-${reference}`,
            paidAt: paidAt(item.paidOn),
          },
        ];
      }),
    );
    const unmatchedPayments = sample.unmatchedPayments.map((item) => ({
      gatewayRef: item.gatewayRef,
      amountPaise: rupees(item.amount),
      status: "unmatched" as const,
      paidAt: paidAt(item.paidOn),
    }));
    await tx.insert(payments).values([...matchedPayments, ...unmatchedPayments]);

    await tx.insert(attendance).values(
      sample.students.flatMap((s) =>
        s.attendance.map((row) => ({ ...row, studentId: studentId.get(s.code)! })),
      ),
    );

    await tx.insert(testScores).values(
      sample.students.flatMap((s) =>
        s.scores.map((row) => ({ ...row, studentId: studentId.get(s.code)! })),
      ),
    );
  });

  console.log(`Seeded ${sample.students.length} students.`);
}

seed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => sqlClient.end());
