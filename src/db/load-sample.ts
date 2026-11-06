import { sql } from "drizzle-orm";
import { rupees } from "@/domain/money";
import { replayDays } from "@/lib/pipeline";
import { runRiskCheck } from "@/lib/risk";
import { db } from "./client";
import { buildSampleData, CENTRES, PLAN_TOTAL, SAMPLE_TODAY } from "./sample-data";
import { buildEvents } from "./sample-events";
import { batches, centres, instalments, students, users } from "./schema";

const TERM = { termStart: "2026-07-01", termEnd: "2027-06-30" };

/** Before the first reminder of the term is due. */
const REPLAY_FROM = "2026-06-25";

/**
 * Only enrolment is written directly, because admissions sit outside this product. All the rest
 * of the sample is replayed day by day through the same code a live day uses, so payments,
 * receipts, reminders, flags and refunds are outcomes of the pipeline, not rows typed in.
 */
export async function loadSampleData() {
  const sample = buildSampleData();

  await db.transaction(async (tx) => {
    await tx.execute(
      sql`truncate table otp_codes, audit_events, month_closes, pipeline_runs, refunds, risk_flags, test_scores, attendance,
          reminders, payments, instalments, consents, students, users, batches, centres cascade`,
    );
    await tx.execute(sql`alter sequence receipt_no_seq restart`);
    await tx.execute(sql`alter sequence credit_note_no_seq restart`);

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

    await tx.insert(users).values([
      { phone: "+919000000100", name: "Accounts Executive", role: "accounts" },
      { phone: "+919000000101", name: "Accounts Manager", role: "accounts" },
    ]);

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

    await tx.insert(instalments).values(
      sample.students.flatMap((s) =>
        s.instalments.map((item, index) => ({
          studentId: studentId.get(s.code)!,
          sequence: index + 1,
          dueDate: item.dueDate,
          amountPaise: rupees(item.amount),
        })),
      ),
    );
  });

  await replayDays(
    REPLAY_FROM,
    SAMPLE_TODAY,
    buildEvents(sample.students, sample.unmatchedPayments),
    "replay",
  );
  await runRiskCheck(SAMPLE_TODAY);

  return { students: sample.students.length };
}
