import { daysBetween, type IsoDate } from "./dates";
import { balanceOf, type Instalment } from "./instalments";

/** Assumptions, see CLAUDE.md. Fixed by judgement, since there is no real dropout history. */
const RECENT_WEEKS = 4;
const MIN_EARLIER_WEEKS = 2;
const RECENT_TESTS = 2;
const MIN_EARLIER_TESTS = 2;

/** Assumption, see CLAUDE.md: this many weeks behind the rest of the batch means records stopped. */
const MISSING_WEEKS = 2;

/** Stored on each flag, so a false-flag rate always refers to a known rule. */
export const RULE_VERSION = "v2";

/** Percentage points lost between the earlier and recent average, and the bands. */
export type RiskRules = {
  attendanceDrop: { mild: number; strong: number };
  testDrop: { mild: number; strong: number };
  watchPoints: number;
  highPoints: number;
};

export const DEFAULT_RULES: RiskRules = {
  attendanceDrop: { mild: 15, strong: 30 },
  testDrop: { mild: 10, strong: 20 },
  watchPoints: 2,
  highPoints: 4,
};

/** After a counsellor closes a task, the job leaves that student alone for this long. */
export const REFLAG_AFTER_DAYS = 30;

export type AttendanceWeek = { weekStart: IsoDate; present: number; total: number };
export type TestScore = { takenOn: IsoDate; score: number; maxScore: number };

export type RiskReason =
  | { kind: "missed"; count: number }
  | { kind: "attendance"; from: number; to: number }
  | { kind: "tests"; from: number; to: number }
  | { kind: "missing"; weeks: number };

export type RiskBand = "none" | "watch" | "high" | "not-enough-data";

export type RiskResult = { band: RiskBand; reasons: RiskReason[] };

export type RiskInput = {
  instalments: Instalment[];
  attendance: AttendanceWeek[];
  scores: TestScore[];
  today: IsoDate;
  /** The latest week recorded for anyone in the batch, to notice records that stopped. */
  batchLatestWeek?: IsoDate | null;
  rules?: RiskRules;
};

const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

/** Earlier and recent averages as whole percentages, or null if there are too few records. */
function trend(percents: number[], recent: number, minEarlier: number) {
  if (percents.length < recent + minEarlier) return null;

  const split = percents.length - recent;
  return {
    from: Math.round(average(percents.slice(0, split))),
    to: Math.round(average(percents.slice(split))),
  };
}

function dropPoints({ from, to }: { from: number; to: number }, drop: RiskRules["testDrop"]) {
  const fall = from - to;
  if (fall >= drop.strong) return 2;
  return fall >= drop.mild ? 1 : 0;
}

/** Weeks this student's attendance is behind the batch, once that is long enough to matter. */
function weeksMissing(attendance: AttendanceWeek[], batchLatestWeek?: IsoDate | null) {
  if (!batchLatestWeek || attendance.length === 0) return 0;

  const last = attendance.map((week) => week.weekStart).sort().at(-1)!;
  const weeks = Math.floor(daysBetween(last, batchLatestWeek) / 7);
  return weeks >= MISSING_WEEKS ? weeks : 0;
}

export function assessRisk({
  instalments,
  attendance,
  scores,
  today,
  batchLatestWeek,
  rules = DEFAULT_RULES,
}: RiskInput): RiskResult {
  const attendanceTrend = trend(
    attendance
      .filter((week) => week.total > 0)
      .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
      .map((week) => (week.present / week.total) * 100),
    RECENT_WEEKS,
    MIN_EARLIER_WEEKS,
  );
  const testTrend = trend(
    scores
      .filter((test) => test.maxScore > 0)
      .sort((a, b) => a.takenOn.localeCompare(b.takenOn))
      .map((test) => (test.score / test.maxScore) * 100),
    RECENT_TESTS,
    MIN_EARLIER_TESTS,
  );

  if (instalments.length === 0 || !attendanceTrend || !testTrend) {
    return { band: "not-enough-data", reasons: [] };
  }

  const missed = instalments.filter(
    (item) => balanceOf(item) > 0 && daysBetween(item.dueDate, today) > 0,
  ).length;

  const attendancePoints = dropPoints(attendanceTrend, rules.attendanceDrop);
  const testPoints = dropPoints(testTrend, rules.testDrop);
  const missing = weeksMissing(attendance, batchLatestWeek);
  // Records that stopped count as the strongest attendance sign, not as an extra one.
  const academicPoints = (missing > 0 ? 2 : attendancePoints) + testPoints;
  const total = Math.min(missed, 2) + academicPoints;

  // Late fees alone are a money problem, which reminders handle. They are not a sign of leaving.
  const band =
    academicPoints === 0 || total < rules.watchPoints
      ? "none"
      : total >= rules.highPoints
        ? "high"
        : "watch";
  if (band === "none") return { band, reasons: [] };

  const reasons: RiskReason[] = [];
  if (missing > 0) reasons.push({ kind: "missing", weeks: missing });
  else if (attendancePoints > 0) reasons.push({ kind: "attendance", ...attendanceTrend });
  if (testPoints > 0) reasons.push({ kind: "tests", ...testTrend });
  if (missed > 0) reasons.push({ kind: "missed", count: missed });

  return { band, reasons };
}

type ExistingTasks = { hasOpenTask: boolean; lastReviewedOn: IsoDate | null };

/** What the job does with one student's result. It can only ever touch a call task. */
export function decideTask(
  { band }: RiskResult,
  { hasOpenTask, lastReviewedOn }: ExistingTasks,
  today: IsoDate,
): "create" | "update" | "skip" {
  if (band !== "watch" && band !== "high") return "skip";
  if (hasOpenTask) return "update";

  const resting =
    lastReviewedOn !== null && daysBetween(lastReviewedOn, today) < REFLAG_AFTER_DAYS;
  return resting ? "skip" : "create";
}

/** The latest week recorded in each batch, read from every student's attendance. */
export function latestWeekByBatch(
  rows: { batchId: string; weekStart: IsoDate }[],
): Map<string, IsoDate> {
  const latest = new Map<string, IsoDate>();
  for (const { batchId, weekStart } of rows) {
    if (weekStart > (latest.get(batchId) ?? "")) latest.set(batchId, weekStart);
  }
  return latest;
}

/** Share of reviewed flags that were wrong, as a whole percentage. Null until one is reviewed. */
export function falseFlagRate(called: number, falseFlags: number): number | null {
  const reviewed = called + falseFlags;
  return reviewed === 0 ? null : Math.round((falseFlags / reviewed) * 100);
}
