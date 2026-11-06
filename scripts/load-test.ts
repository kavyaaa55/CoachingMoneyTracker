/**
 * Times the daily pipeline and the heaviest pages at Company A's real size: 2,600 students.
 * It runs on the test database only, and wipes it. Run with `npm run test:load`.
 */
import { sql } from "drizzle-orm";
import { addDays } from "../src/domain/dates";

const url = new URL(process.env.DATABASE_URL ?? "");
url.pathname = "/fee_tracker_test";
process.env.DATABASE_URL = url.href;
process.env.GEMINI_API_KEY = "";

const STUDENTS = Number(process.env.LOAD_STUDENTS ?? 2600);
const TODAY = "2026-11-02";
const CHUNK = 2000;
const SMS_MS = 200;

async function timed<T>(name: string, work: () => Promise<T>) {
  const start = performance.now();
  const result = await work();
  const ms = Math.round(performance.now() - start);
  console.log(`${String(ms).padStart(7)} ms  ${name}`);
  return result;
}

async function main() {
  const { db, sqlClient } = await import("../src/db/client");
  const schema = await import("../src/db/schema");
  const { runDay } = await import("../src/lib/pipeline");
  const { duesInstalments, tallyReceipts } = await import("../src/lib/dues");
  const { listStudents } = await import("../src/lib/staff-students");
  const { monthReport, queueWithSuggestions } = await import("../src/lib/books");
  const { scoredInstalments, reminderResponse } = await import("../src/lib/scoreboard");

  const insert = async <T>(table: Parameters<typeof db.insert>[0], rows: T[]) => {
    const inserted: { id: string }[] = [];
    for (let at = 0; at < rows.length; at += CHUNK) {
      const chunk = rows.slice(at, at + CHUNK) as never[];
      inserted.push(...((await db.insert(table).values(chunk).returning()) as { id: string }[]));
    }
    return inserted;
  };

  await db.execute(
    sql`truncate table rate_limits, audit_events, month_closes, pipeline_runs, refunds, risk_flags, test_scores, attendance, reminders, payments, instalments, consents, students, users, batches, centres cascade`,
  );

  await timed(`build ${STUDENTS} students`, async () => {
    const centres = await insert(
      schema.centres,
      [1, 2, 3, 4].map((n) => ({ name: `Centre ${n}` })),
    );
    const batches = await insert(
      schema.batches,
      centres.flatMap((centre) =>
        ["JEE Morning", "JEE Evening", "NEET Morning", "NEET Evening"].map((name) => ({
          name,
          centreId: centre.id,
        })),
      ),
    );
    await db.insert(schema.users).values({ phone: "+919000000100", name: "Staff", role: "accounts" });
    const parents = await insert(
      schema.users,
      Array.from({ length: STUDENTS }, (_, i) => ({
        phone: `+9180${String(i).padStart(8, "0")}`,
        name: `Parent ${i}`,
        role: "parent",
      })),
    );
    const students = await insert(
      schema.students,
      parents.map((parent, i) => ({
        code: `STU-${i}`,
        name: `Student ${i}`,
        batchId: batches[i % batches.length].id,
        parentId: parent.id,
        planTotalPaise: 12_000_000,
        termStart: "2026-07-01",
        termEnd: "2027-06-30",
      })),
    );
    const dueDates = ["2026-07-10", "2026-10-10", "2027-01-10", "2027-04-10"];
    const instalments = await insert(
      schema.instalments,
      students.flatMap((student) =>
        dueDates.map((dueDate, index) => ({
          studentId: student.id,
          sequence: index + 1,
          dueDate,
          amountPaise: 3_000_000,
        })),
      ),
    );
    // Most paid the first instalment, and most of the second.
    await insert(
      schema.payments,
      instalments.flatMap((item, i) =>
        i % 4 === 0 || (i % 4 === 1 && i % 5 !== 1)
          ? [
              {
                gatewayRef: `L-${i}`,
                instalmentId: item.id,
                amountPaise: 3_000_000,
                status: "matched",
                receiptNo: `RCT-${String(i).padStart(7, "0")}`,
                paidAt: new Date("2026-10-05T06:00:00Z"),
              },
            ]
          : [],
      ),
    );
    await insert(
      schema.attendance,
      students.flatMap((student, s) =>
        Array.from({ length: 12 }, (_, w) => ({
          studentId: student.id,
          weekStart: addDays("2026-08-10", w * 7),
          present: s % 40 === 0 && w > 7 ? 2 : 6,
          total: 6,
        })),
      ),
    );
    await insert(
      schema.testScores,
      students.flatMap((student, s) =>
        Array.from({ length: 6 }, (_, t) => ({
          studentId: student.id,
          testName: `Test ${t}`,
          takenOn: addDays("2026-07-25", t * 18),
          score: s % 40 === 0 && t > 3 ? 100 : 220,
          maxScore: 300,
        })),
      ),
    );
  });

  const filters = { centreId: null, batch: null };
  await timed("runDay: first run, plans and sends reminders", () => runDay(TODAY, "staff"));
  await timed("runDay: second run, nothing new to send", () => runDay(TODAY, "staff"));
  await timed("Dues: all instalments", () => duesInstalments(filters));
  await timed("Students: search page", () => listStudents({ search: "Student 25", centreId: null, page: 1 }));
  await timed("Scoreboard: instalments", () => scoredInstalments());
  await timed("Scoreboard: reminder response", () => reminderResponse());
  await timed("Books: month report", () => monthReport("2026-10"));
  await timed("Books: queue suggestions", () => queueWithSuggestions());
  await timed("Tally: one month's receipts", () =>
    tallyReceipts({ ...filters, from: "2026-10-01", to: "2026-10-31" }),
  );

  // The mock sender takes no time, so this shows what a real SMS provider would cost.
  const { runReminders } = await import("../src/lib/reminders");
  await db.execute(sql`delete from reminders`);
  const slowSender = () => new Promise<void>((resolve) => setTimeout(resolve, SMS_MS));
  await timed(`Reminders with a ${SMS_MS} ms provider`, () => runReminders(TODAY, slowSender));

  const { labStudents } = await import("../src/lib/risk-lab");
  const { replayRule, suggestRules } = await import("../src/domain/risk-lab");
  const lab = await timed("Risk Lab: load records", () => labStudents());
  await timed("Risk Lab: replay the term", async () =>
    replayRule(lab.students, lab.termStart, TODAY),
  );
  const withLeavers = lab.students.map((student, index) =>
    index % 40 === 0 ? { ...student, exitDate: "2026-10-28" } : student,
  );
  await timed("Risk Lab: learn numbers", async () =>
    suggestRules(withLeavers, lab.termStart, TODAY, []),
  );

  await sqlClient.end();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
