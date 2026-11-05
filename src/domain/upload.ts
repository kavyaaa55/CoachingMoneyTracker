import { addDays, isMonday, type IsoDate } from "./dates";

/** Assumptions, see CLAUDE.md. Far above a real batch file, and well inside the request limit. */
export const UPLOAD_MAX_BYTES = 200_000;
export const UPLOAD_MAX_ROWS = 2000;
const MAX_WEEKLY_CLASSES = 50;
const MAX_TEST_MARKS = 1000;
const MAX_TEST_NAME = 60;

export const UPLOAD_KINDS = ["attendance", "scores"] as const;
export type UploadKind = (typeof UPLOAD_KINDS)[number];

export type UploadProblem =
  | "missing-column"
  | "no-rows"
  | "too-many-rows"
  | "not-in-batch"
  | "missing-value"
  | "duplicate"
  | "bad-date"
  | "future-date"
  | "before-term"
  | "after-exit"
  | "not-monday"
  | "bad-number"
  | "present-over-total"
  | "score-over-max"
  | "name-too-long";

/** Stored as facts, so each language can word them on screen. */
export type UploadError = { line: number; problem: UploadProblem; value: string };

export type UploadStudent = {
  id: string;
  code: string;
  name: string;
  termStart: IsoDate;
  exitDate: IsoDate | null;
};

export type AttendanceRecord = {
  studentId: string;
  weekStart: IsoDate;
  present: number;
  total: number;
};

export type ScoreRecord = {
  studentId: string;
  testName: string;
  takenOn: IsoDate;
  score: number;
  maxScore: number;
};

export type UploadResult<T> = { records: T[]; blank: number; errors: UploadError[] };

type UploadContext = { students: UploadStudent[]; today: IsoDate };
type RowOutcome<T> = T | { problem: UploadProblem; value: string };

const COLUMNS: Record<UploadKind, string[]> = {
  attendance: ["Student ID", "Week start", "Present", "Total"],
  scores: ["Student ID", "Test name", "Date", "Score", "Max score"],
};

/** The template adds a name column, so staff can see who each row is. The reader ignores it. */
export function templateColumns(kind: UploadKind): string[] {
  const [id, ...rest] = COLUMNS[kind];
  return [id, "Name", ...rest];
}

/** Reads what Excel writes: a byte order mark, Windows line ends and quoted cells. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  const source = text.replace(/^﻿/, "");
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }

  if (cell || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/** Excel rewrites dates day first, so both forms are accepted. Returns null if not a real date. */
export function parseUploadDate(input: string): IsoDate | null {
  const dayFirst = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(input);
  const iso = dayFirst
    ? `${dayFirst[3]}-${dayFirst[2].padStart(2, "0")}-${dayFirst[1].padStart(2, "0")}`
    : input;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;

  const time = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(time)) return null;
  return new Date(time).toISOString().slice(0, 10) === iso ? iso : null;
}

const wholeNumber = (input: string) => (/^\d{1,6}$/.test(input) ? Number(input) : null);

/** A mistyped year or a date after the student left should stop the file, not skew the flag. */
function checkDate(
  input: string,
  student: UploadStudent,
  today: IsoDate,
): RowOutcome<{ date: IsoDate }> {
  const date = parseUploadDate(input);
  if (!date) return { problem: "bad-date", value: input };
  if (date > today) return { problem: "future-date", value: input };
  if (date < addDays(student.termStart, -6)) return { problem: "before-term", value: input };
  if (student.exitDate && date > student.exitDate) return { problem: "after-exit", value: input };
  return { date };
}

function readRows<T extends object>(
  text: string,
  kind: UploadKind,
  { students }: UploadContext,
  keyOf: (record: T) => string,
  readValues: (values: string[], student: UploadStudent) => RowOutcome<T>,
): UploadResult<T> {
  const fail = (line: number, problem: UploadProblem, value = ""): UploadResult<T> => ({
    records: [],
    blank: 0,
    errors: [{ line, problem, value }],
  });

  const [header = [], ...lines] = parseCsv(text);
  const names = header.map((name) => name.trim().toLowerCase());
  const positions = COLUMNS[kind].map((column) => names.indexOf(column.toLowerCase()));

  const missing = COLUMNS[kind].filter((_, index) => positions[index] === -1);
  if (missing.length > 0) return fail(1, "missing-column", missing.join(", "));
  if (lines.length > UPLOAD_MAX_ROWS) return fail(1, "too-many-rows", String(UPLOAD_MAX_ROWS));

  const byCode = new Map(students.map((student) => [student.code.toUpperCase(), student]));
  const seen = new Set<string>();
  const result: UploadResult<T> = { records: [], blank: 0, errors: [] };

  lines.forEach((cells, index) => {
    const line = index + 2;
    const [code, ...values] = positions.map((position) => (cells[position] ?? "").trim());
    const report = (problem: UploadProblem, value: string) =>
      result.errors.push({ line, problem, value });

    if (values.every((value) => value === "")) {
      // A template row left empty, such as a student absent from a test.
      if (code) result.blank += 1;
      return;
    }

    const student = byCode.get(code.toUpperCase());
    if (!student) return void report("not-in-batch", code);
    if (values.some((value) => value === "")) return void report("missing-value", student.code);

    const outcome = readValues(values, student);
    if ("problem" in outcome) return void report(outcome.problem, outcome.value);

    const key = keyOf(outcome);
    if (seen.has(key)) return void report("duplicate", student.code);
    seen.add(key);
    result.records.push(outcome);
  });

  if (result.records.length === 0 && result.errors.length === 0) return fail(1, "no-rows");
  return result;
}

export const attendanceKey = (record: AttendanceRecord) => `${record.studentId}|${record.weekStart}`;
export const scoreKey = (record: ScoreRecord) => `${record.studentId}|${record.testName}`;

export function readAttendance(text: string, context: UploadContext) {
  return readRows<AttendanceRecord>(text, "attendance", context, attendanceKey, (values, student) => {
    const [weekInput, presentInput, totalInput] = values;

    const week = checkDate(weekInput, student, context.today);
    if ("problem" in week) return week;
    if (!isMonday(week.date)) return { problem: "not-monday", value: weekInput };

    const present = wholeNumber(presentInput);
    if (present === null) return { problem: "bad-number", value: presentInput };
    const total = wholeNumber(totalInput);
    if (total === null || total === 0 || total > MAX_WEEKLY_CLASSES) {
      return { problem: "bad-number", value: totalInput };
    }
    if (present > total) return { problem: "present-over-total", value: `${present} / ${total}` };

    return { studentId: student.id, weekStart: week.date, present, total };
  });
}

export function readScores(text: string, context: UploadContext) {
  return readRows<ScoreRecord>(text, "scores", context, scoreKey, (values, student) => {
    const [testName, dateInput, scoreInput, maxInput] = values;

    if (testName.length > MAX_TEST_NAME) return { problem: "name-too-long", value: testName };

    const taken = checkDate(dateInput, student, context.today);
    if ("problem" in taken) return taken;

    const score = wholeNumber(scoreInput);
    if (score === null) return { problem: "bad-number", value: scoreInput };
    const maxScore = wholeNumber(maxInput);
    if (maxScore === null || maxScore === 0 || maxScore > MAX_TEST_MARKS) {
      return { problem: "bad-number", value: maxInput };
    }
    if (score > maxScore) return { problem: "score-over-max", value: `${score} / ${maxScore}` };

    return { studentId: student.id, testName, takenOn: taken.date, score, maxScore };
  });
}

export type ChangeStatus = "new" | "changed" | "same";
export type Change<T> = { record: T; before: T | null; status: ChangeStatus };

/** Compares a file with what is saved, so a repeat upload is seen as nothing new. */
export function compareWithSaved<T>(
  records: T[],
  saved: T[],
  keyOf: (record: T) => string,
  isSame: (a: T, b: T) => boolean,
): Change<T>[] {
  const savedByKey = new Map(saved.map((record) => [keyOf(record), record]));

  return records.map((record) => {
    const before = savedByKey.get(keyOf(record)) ?? null;
    if (!before) return { record, before, status: "new" };
    return { record, before, status: isSame(record, before) ? "same" : "changed" };
  });
}
