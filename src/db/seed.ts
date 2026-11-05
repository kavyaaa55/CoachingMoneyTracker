import { sql } from "drizzle-orm";
import { rupees } from "@/domain/money";
import { db, sqlClient } from "./client";
import { batches, centres, instalments, payments, students, users } from "./schema";

/** The three rows from the brief. All people and phone numbers are fictional. */
const briefStudents = [
  {
    code: "STU-0412",
    name: "Aarav Meena",
    batch: "JEE 2027 Morning",
    phone: "+919000000001",
    language: "en",
    plan: [
      { dueDate: "2026-07-10", amount: 30000, paid: 30000 },
      { dueDate: "2026-10-10", amount: 30000, paid: 30000 },
      { dueDate: "2027-01-10", amount: 30000, paid: 0 },
      { dueDate: "2027-04-10", amount: 30000, paid: 0 },
    ],
  },
  {
    code: "STU-0587",
    name: "Ishita Sharma",
    batch: "JEE 2027 Evening",
    phone: "+919000000002",
    language: "hi",
    plan: [
      { dueDate: "2026-07-10", amount: 30000, paid: 30000 },
      { dueDate: "2026-10-10", amount: 30000, paid: 15000 },
      { dueDate: "2027-01-10", amount: 30000, paid: 0 },
      { dueDate: "2027-04-10", amount: 30000, paid: 0 },
    ],
  },
  {
    code: "STU-0219",
    name: "Mohit Gurjar",
    batch: "NEET 2027 Morning",
    phone: "+919000000003",
    language: "hi",
    plan: [
      { dueDate: "2026-07-15", amount: 40000, paid: 40000 },
      { dueDate: "2026-11-15", amount: 40000, paid: 0 },
      { dueDate: "2027-03-15", amount: 40000, paid: 0 },
    ],
  },
] as const;

async function seed() {
  await db.execute(
    sql`truncate table refunds, risk_flags, test_scores, attendance, reminders, payments,
        instalments, consents, students, users, batches, centres cascade`,
  );

  const allCentres = await db
    .insert(centres)
    .values([1, 2, 3, 4].map((n) => ({ name: `Centre ${n}` })))
    .returning();

  await db.insert(users).values({
    phone: "+919000000100",
    name: "Accounts Executive",
    role: "accounts",
  });

  for (const row of briefStudents) {
    const [batch] = await db
      .insert(batches)
      .values({ name: row.batch, centreId: allCentres[0].id })
      .returning();

    const [parent] = await db
      .insert(users)
      .values({
        phone: row.phone,
        name: `Parent of ${row.name}`,
        role: "parent",
        language: row.language,
      })
      .returning();

    const [student] = await db
      .insert(students)
      .values({
        code: row.code,
        name: row.name,
        batchId: batch.id,
        parentId: parent.id,
        planTotalPaise: rupees(row.plan.reduce((sum, item) => sum + item.amount, 0)),
        termStart: "2026-07-01",
        termEnd: "2027-06-30",
      })
      .returning();

    for (const [index, item] of row.plan.entries()) {
      const [instalment] = await db
        .insert(instalments)
        .values({
          studentId: student.id,
          sequence: index + 1,
          dueDate: item.dueDate,
          amountPaise: rupees(item.amount),
        })
        .returning();

      if (item.paid > 0) {
        const reference = `${row.code}-${index + 1}`;
        await db.insert(payments).values({
          gatewayRef: `SEED-${reference}`,
          instalmentId: instalment.id,
          amountPaise: rupees(item.paid),
          status: "matched",
          receiptNo: `RCT-${reference}`,
          paidAt: new Date(`${item.dueDate}T06:00:00Z`),
        });
      }
    }
  }

  console.log(`Seeded ${briefStudents.length} students.`);
}

seed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => sqlClient.end());
