import { addDays, daysBetween, type IsoDate } from "./dates";
import type { Instalment } from "./instalments";
import type { Paise } from "./money";
import {
  assessRisk,
  batchBaseline,
  DEFAULT_RULES,
  riskFacts,
  type AttendanceWeek,
  type RiskInput,
  type RiskReason,
  type RiskRules,
  type TestScore,
} from "./risk";

export type LabStudent = {
  code: string;
  name: string;
  batchId: string;
  exitDate: IsoDate | null;
  instalments: {
    dueDate: IsoDate;
    amount: Paise;
    payments: { amount: Paise; paidOn: IsoDate }[];
  }[];
  attendance: AttendanceWeek[];
  scores: TestScore[];
};

export type LabOutcome = "caught" | "missed" | "open";

export type LabRow = {
  code: string;
  name: string;
  firstFlag: IsoDate | null;
  exitDate: IsoDate | null;
  warningDays: number | null;
  outcome: LabOutcome;
};

/** A week's file is sent on its Sunday, and a test's file the day after the test. */
const weekKnownOn = (weekStart: IsoDate) => addDays(weekStart, 6);
const scoreKnownOn = (takenOn: IsoDate) => addDays(takenOn, 1);

/**
 * What the system knew on a past day. Without this a replay would use payments and marks from
 * the future, and the rule would look far better than it was.
 */
export function knownOn(student: LabStudent, date: IsoDate) {
  const instalments: Instalment[] = student.instalments.map(({ dueDate, amount, payments }) => ({
    dueDate,
    amount,
    paid: payments
      .filter((payment) => payment.paidOn <= date)
      .reduce((sum, payment) => sum + payment.amount, 0),
  }));

  return {
    instalments,
    attendance: student.attendance.filter((week) => weekKnownOn(week.weekStart) <= date),
    scores: student.scores.filter((test) => scoreKnownOn(test.takenOn) <= date),
  };
}

function batchLatestOn(batch: LabStudent[], date: IsoDate) {
  let latest: IsoDate | null = null;
  for (const student of batch) {
    if (student.exitDate && student.exitDate < date) continue;
    for (const { weekStart } of student.attendance) {
      if (weekKnownOn(weekStart) <= date && (!latest || weekStart > latest)) latest = weekStart;
    }
  }
  return latest;
}

/** The first Monday on or after a date. */
function firstMonday(date: IsoDate): IsoDate {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return addDays(date, (8 - day) % 7);
}

type Snapshot = { code: string; input: Omit<RiskInput, "rules"> };

/** What was known on each Monday. Worked out once, so many rules can be tried against it. */
export function snapshots(students: LabStudent[], termStart: IsoDate, today: IsoDate): Snapshot[][] {
  const days: Snapshot[][] = [];
  const everyBatch = Map.groupBy(students, (student) => student.batchId);

  for (let date = firstMonday(termStart); date <= today; date = addDays(date, 7)) {
    const enrolled = students.filter((student) => !student.exitDate || student.exitDate > date);
    const known = new Map(enrolled.map((student) => [student.code, knownOn(student, date)]));

    // Worked out once per batch. Doing it per student made this quadratic at real size.
    const batches = new Map(
      [...Map.groupBy(enrolled, (student) => student.batchId)].map(([batchId, members]) => [
        batchId,
        {
          baseline: batchBaseline(members.map((student) => known.get(student.code)!)),
          latest: batchLatestOn(everyBatch.get(batchId)!, date),
        },
      ]),
    );

    days.push(
      enrolled.map((student) => ({
        code: student.code,
        input: {
          ...known.get(student.code)!,
          today: date,
          batchLatestWeek: batches.get(student.batchId)!.latest,
          baseline: batches.get(student.batchId)!.baseline,
        },
      })),
    );
  }
  return days;
}

/** Runs the rule on every Monday from the start of term, for students enrolled that day. */
export function replayRule(
  students: LabStudent[],
  termStart: IsoDate,
  today: IsoDate,
  rules: RiskRules = DEFAULT_RULES,
  days: Snapshot[][] = snapshots(students, termStart, today),
): LabRow[] {
  const flagged = new Map<string, IsoDate>();

  for (const day of days) {
    for (const { code, input } of day) {
      if (flagged.has(code)) continue;

      const { band } = assessRisk({ ...input, rules });
      if (band === "watch" || band === "high") flagged.set(code, input.today);
    }
  }

  return students
    .filter((student) => student.exitDate || flagged.has(student.code))
    .map(({ code, name, exitDate }) => {
      const firstFlag = flagged.get(code) ?? null;
      return {
        code,
        name,
        firstFlag,
        exitDate,
        warningDays: firstFlag && exitDate ? daysBetween(firstFlag, exitDate) : null,
        outcome: !exitDate ? ("open" as const) : firstFlag ? ("caught" as const) : ("missed" as const),
      };
    })
    .sort((a, b) => (a.firstFlag ?? "9").localeCompare(b.firstFlag ?? "9"));
}

export function summariseReplay(rows: LabRow[]) {
  const caught = rows.filter((row) => row.outcome === "caught");
  const warnings = caught.map((row) => row.warningDays ?? 0);

  return {
    left: rows.filter((row) => row.exitDate).length,
    caught: caught.length,
    open: rows.filter((row) => row.outcome === "open").length,
    averageWarning:
      warnings.length === 0
        ? null
        : Math.round(warnings.reduce((sum, days) => sum + days, 0) / warnings.length),
  };
}

/** Who a change of numbers would add or drop, against the live rule. */
export function compareReplays(live: LabRow[], trial: LabRow[]) {
  const flaggedIn = (rows: LabRow[]) => rows.filter((row) => row.firstFlag);
  const codes = (rows: LabRow[]) => new Set(flaggedIn(rows).map((row) => row.code));
  const liveCodes = codes(live);
  const trialCodes = codes(trial);

  return {
    added: flaggedIn(trial).filter((row) => !liveCodes.has(row.code)).map((row) => row.name),
    dropped: flaggedIn(live).filter((row) => !trialCodes.has(row.code)).map((row) => row.name),
  };
}

/** Below this much evidence, the lab says so rather than suggesting anything. */
const MIN_EVIDENCE = 3;

/** Catching a leaver is worth most, and flagging someone a counsellor called false costs most. */
function scoreRows(rows: LabRow[], falseFlagCodes: Set<string>) {
  return rows.reduce((score, row) => {
    if (row.outcome === "caught") return score + 3;
    if (row.outcome === "open") return score - (falseFlagCodes.has(row.code) ? 3 : 0.5);
    return score;
  }, 0);
}

export type RuleSuggestion =
  | { kind: "too-little-evidence"; evidence: number }
  | { kind: "keep-live-rule" }
  | { kind: "better"; rules: RiskRules; live: LabRow[]; trial: LabRow[] };

/**
 * Learns from what really happened: who left, and which flags counsellors called false. It tries
 * each set of numbers against the term and proposes the best. It never changes the live rule.
 */
export function suggestRules(
  students: LabStudent[],
  termStart: IsoDate,
  today: IsoDate,
  falseFlagCodes: string[],
): RuleSuggestion {
  const evidence = students.filter((s) => s.exitDate).length + falseFlagCodes.length;
  if (evidence < MIN_EVIDENCE) return { kind: "too-little-evidence", evidence };

  const falseCodes = new Set(falseFlagCodes);
  // A student with no sign can never be flagged by any numbers tried here, so skip them.
  const days = snapshots(students, termStart, today).map((day) =>
    day.filter(({ input }) => riskFacts(input).hasAcademicSign),
  );
  const live = replayRule(students, termStart, today, DEFAULT_RULES, days);
  let best = { rules: DEFAULT_RULES, rows: live, score: scoreRows(live, falseCodes) };

  for (const attendanceMild of [10, 15, 20])
    for (const attendanceStrong of [25, 30, 40])
      for (const testMild of [5, 10, 15])
        for (const testStrong of [15, 20, 30])
          for (const watchPoints of [2, 3]) {
            if (testMild >= testStrong) continue;
            const rules: RiskRules = {
              attendanceDrop: { mild: attendanceMild, strong: attendanceStrong },
              testDrop: { mild: testMild, strong: testStrong },
              watchPoints,
              highPoints: 4,
            };
            const rows = replayRule(students, termStart, today, rules, days);
            const score = scoreRows(rows, falseCodes);
            if (score > best.score) best = { rules, rows, score };
          }

  return best.rules === DEFAULT_RULES
    ? { kind: "keep-live-rule" }
    : { kind: "better", rules: best.rules, live, trial: best.rows };
}

type ReviewedFlag = { status: string; reasons: RiskReason[] };

/** Which signs counsellors disagree with most, as a person decides whether to change a rule. */
export function falseFlagsByReason(flags: ReviewedFlag[]) {
  const reviewed = flags.filter((flag) => flag.status !== "open");
  const kinds = [...new Set(reviewed.flatMap((flag) => flag.reasons.map((reason) => reason.kind)))];

  return kinds.sort().map((kind) => {
    const withKind = reviewed.filter((flag) => flag.reasons.some((reason) => reason.kind === kind));
    return {
      kind,
      reviewed: withKind.length,
      falseFlags: withKind.filter((flag) => flag.status === "false_flag").length,
    };
  });
}

const number = (value: string | undefined, fallback: number) =>
  value === undefined || value === "" ? fallback : Number(value);

type RuleQuery = Partial<Record<"am" | "as" | "tm" | "ts" | "w" | "h", string>>;

/** Reads numbers from the page address. Anything unusable falls back to the live rule. */
export function readRules(query: RuleQuery): { rules: RiskRules; invalid: boolean } {
  const { attendanceDrop, testDrop, watchPoints, highPoints } = DEFAULT_RULES;
  const rules: RiskRules = {
    attendanceDrop: {
      mild: number(query.am, attendanceDrop.mild),
      strong: number(query.as, attendanceDrop.strong),
    },
    testDrop: { mild: number(query.tm, testDrop.mild), strong: number(query.ts, testDrop.strong) },
    watchPoints: number(query.w, watchPoints),
    highPoints: number(query.h, highPoints),
  };

  const values = [
    rules.attendanceDrop.mild,
    rules.attendanceDrop.strong,
    rules.testDrop.mild,
    rules.testDrop.strong,
    rules.watchPoints,
    rules.highPoints,
  ];
  const valid =
    values.every((value) => Number.isInteger(value) && value >= 1 && value <= 100) &&
    rules.attendanceDrop.mild < rules.attendanceDrop.strong &&
    rules.testDrop.mild < rules.testDrop.strong &&
    rules.watchPoints < rules.highPoints;

  return valid ? { rules, invalid: false } : { rules: DEFAULT_RULES, invalid: true };
}
