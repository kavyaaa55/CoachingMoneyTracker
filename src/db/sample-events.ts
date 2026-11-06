import { addDays } from "@/domain/dates";
import { rupees } from "@/domain/money";
import { inDayOrder, type PipelineEvent } from "@/domain/pipeline";
import { csvCell } from "@/domain/tally";
import type { SampleStudent, UnmatchedPayment } from "./sample-data";

export const toCsv = (rows: (string | number)[][]) =>
  rows.map((row) => row.map((cell) => csvCell(String(cell))).join(",")).join("\r\n");

const byBatch = (students: SampleStudent[]) => {
  const groups = new Map<string, SampleStudent[]>();
  for (const student of students) {
    const key = `${student.centre}|${student.batch}`;
    groups.set(key, [...(groups.get(key) ?? []), student]);
  }
  return [...groups.values()];
};

/** One file per batch per week, sent on the Sunday the week ends, as a centre would. */
function attendanceFiles(batch: SampleStudent[]): PipelineEvent[] {
  const { centre, batch: name } = batch[0];
  const weeks = new Set(batch.flatMap((student) => student.attendance.map((w) => w.weekStart)));

  return [...weeks].map((weekStart) => ({
    on: addDays(weekStart, 6),
    kind: "upload",
    centre,
    batch: name,
    file: "attendance",
    text: toCsv([
      ["Student ID", "Week start", "Present", "Total"],
      ...batch.flatMap((student) =>
        student.attendance
          .filter((week) => week.weekStart === weekStart)
          .map((week) => [student.code, week.weekStart, week.present, week.total]),
      ),
    ]),
  }));
}

/** One file per batch per test, sent the day after the test. */
function scoreFiles(batch: SampleStudent[]): PipelineEvent[] {
  const { centre, batch: name } = batch[0];
  const tests = new Map(
    batch.flatMap((student) => student.scores.map((test) => [test.testName, test.takenOn])),
  );

  return [...tests].map(([testName, takenOn]) => ({
    on: addDays(takenOn, 1),
    kind: "upload",
    centre,
    batch: name,
    file: "scores",
    text: toCsv([
      ["Student ID", "Test name", "Date", "Score", "Max score"],
      ...batch.flatMap((student) =>
        student.scores
          .filter((test) => test.testName === testName)
          .map((test) => [student.code, test.testName, test.takenOn, test.score, test.maxScore]),
      ),
    ]),
  }));
}

function studentEvents(student: SampleStudent): PipelineEvent[] {
  const { code, exit } = student;

  const paid = student.instalments.flatMap((item, index): PipelineEvent[] => {
    if (item.paid === 0 || !item.paidOn) return [];
    const common = {
      on: item.paidOn,
      gatewayRef: `SEED-${code}-${index + 1}`,
      instalment: { code, sequence: index + 1 },
      amount: rupees(item.paid),
    };
    // First instalments were paid at the counter, later ones online.
    return [index === 0 ? { ...common, kind: "counter" } : { ...common, kind: "gateway" }];
  });

  if (!exit) return paid;
  return [
    ...paid,
    { on: exit.on, kind: "exit", code },
    ...(exit.approvedOn ? [{ on: exit.approvedOn, kind: "refund-approved", code } as const] : []),
    ...(exit.paidOn
      ? [{ on: exit.paidOn, kind: "refund-paid", code, reference: `NEFT-${code}` } as const]
      : []),
  ];
}

/** Turns the sample into the stream of events that would have produced it. */
export function buildEvents(
  students: SampleStudent[],
  unmatched: UnmatchedPayment[],
): PipelineEvent[] {
  return inDayOrder([
    ...byBatch(students).flatMap((batch) => [...attendanceFiles(batch), ...scoreFiles(batch)]),
    ...students.flatMap(studentEvents),
    ...unmatched.map(
      (item): PipelineEvent => ({
        on: item.paidOn,
        kind: "gateway",
        gatewayRef: item.gatewayRef,
        instalment: item.claims ?? null,
        amount: rupees(item.amount),
      }),
    ),
  ]);
}
