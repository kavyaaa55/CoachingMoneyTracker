import { describe, expect, it } from "vitest";
import {
  attendanceKey,
  compareWithSaved,
  parseCsv,
  parseUploadDate,
  readAttendance,
  readScores,
  templateColumns,
  UPLOAD_MAX_ROWS,
  type AttendanceRecord,
} from "./upload";

const student = (code: string, exitDate: string | null = null) => ({
  id: `id-${code}`,
  code,
  name: code,
  termStart: "2026-07-01",
  exitDate,
});

const context = {
  today: "2026-11-02",
  students: [student("STU-0412"), student("STU-0587"), student("STU-0219", "2026-10-25")],
};

const attendanceFile = (...rows: string[]) =>
  ["Student ID,Week start,Present,Total", ...rows].join("\n");
const scoresFile = (...rows: string[]) =>
  ["Student ID,Test name,Date,Score,Max score", ...rows].join("\n");

const problems = (result: { errors: { line: number; problem: string }[] }) =>
  result.errors.map(({ line, problem }) => [line, problem]);

describe("parseCsv", () => {
  it("reads what Excel saves", () => {
    expect(parseCsv('﻿a,b\r\n"x, y","say ""hi"""\r\n')).toEqual([
      ["a", "b"],
      ["x, y", 'say "hi"'],
    ]);
  });

  it("keeps a last line with no line end", () => {
    expect(parseCsv("a\nb")).toEqual([["a"], ["b"]]);
  });

  it("has no rows for an empty file", () => {
    expect(parseCsv("")).toEqual([]);
  });
});

describe("parseUploadDate", () => {
  it("accepts year first and day first", () => {
    expect(parseUploadDate("2026-11-02")).toBe("2026-11-02");
    expect(parseUploadDate("02-11-2026")).toBe("2026-11-02");
    expect(parseUploadDate("2/11/2026")).toBe("2026-11-02");
  });

  it("refuses dates that do not exist", () => {
    expect(parseUploadDate("31-02-2026")).toBeNull();
    expect(parseUploadDate("2026-13-01")).toBeNull();
    expect(parseUploadDate("next Monday")).toBeNull();
    expect(parseUploadDate("02-11-26")).toBeNull();
  });
});

describe("readAttendance", () => {
  it("reads a good file", () => {
    const result = readAttendance(attendanceFile("STU-0412,2026-11-02,5,6"), context);
    expect(result).toEqual({
      records: [{ studentId: "id-STU-0412", weekStart: "2026-11-02", present: 5, total: 6 }],
      blank: 0,
      errors: [],
    });
  });

  it("finds columns by name, in any order, ignoring extras and case", () => {
    const text = "name,TOTAL,present,week start,student id\nAarav,6,5,2026-11-02,stu-0412";
    expect(readAttendance(text, context).records).toHaveLength(1);
  });

  it("names any missing column", () => {
    const result = readAttendance("Student ID,Present\nSTU-0412,5", context);
    expect(result.errors).toEqual([
      { line: 1, problem: "missing-column", value: "Week start, Total" },
    ]);
  });

  it("counts template rows left empty, and is not fooled by blank lines", () => {
    const result = readAttendance(
      attendanceFile("STU-0412,,,", "", "STU-0587,2026-11-02,6,6"),
      context,
    );
    expect(result.blank).toBe(1);
    expect(result.records).toHaveLength(1);
    expect(result.errors).toEqual([]);
  });

  it("says so when there is nothing to read", () => {
    expect(problems(readAttendance(attendanceFile("STU-0412,,,"), context))).toEqual([
      [1, "no-rows"],
    ]);
    expect(problems(readAttendance("", context))[0]).toEqual([1, "missing-column"]);
  });

  it("refuses a file that is too long", () => {
    const rows = Array.from({ length: UPLOAD_MAX_ROWS + 1 }, () => "STU-0412,2026-11-02,5,6");
    expect(problems(readAttendance(attendanceFile(...rows), context))).toEqual([
      [1, "too-many-rows"],
    ]);
  });

  it("reports every bad row, with the line it is on", () => {
    const result = readAttendance(
      attendanceFile(
        "STU-9999,2026-11-02,5,6",
        "STU-0412,2026-11-02,,6",
        "STU-0412,not a date,5,6",
        "STU-0412,2026-11-09,5,6",
        "STU-0412,2025-11-03,5,6",
        "STU-0412,2026-10-28,5,6",
        "STU-0412,2026-11-02,five,6",
        "STU-0412,2026-11-02,-1,6",
        "STU-0412,2026-11-02,5.5,6",
        "STU-0412,2026-11-02,5,0",
        "STU-0412,2026-11-02,5,51",
        "STU-0412,2026-11-02,7,6",
      ),
      context,
    );

    expect(result.records).toEqual([]);
    expect(problems(result)).toEqual([
      [2, "not-in-batch"],
      [3, "missing-value"],
      [4, "bad-date"],
      [5, "future-date"],
      [6, "before-term"],
      [7, "not-monday"],
      [8, "bad-number"],
      [9, "bad-number"],
      [10, "bad-number"],
      [11, "bad-number"],
      [12, "bad-number"],
      [13, "present-over-total"],
    ]);
  });

  it("refuses the same student and week twice", () => {
    const result = readAttendance(
      attendanceFile("STU-0412,2026-11-02,5,6", "STU-0412,02-11-2026,4,6"),
      context,
    );
    expect(problems(result)).toEqual([[3, "duplicate"]]);
  });

  it("refuses a date after the student left, and accepts one before", () => {
    const result = readAttendance(
      attendanceFile("STU-0219,2026-10-19,5,6", "STU-0219,2026-10-26,5,6"),
      context,
    );
    expect(result.records).toHaveLength(1);
    expect(problems(result)).toEqual([[3, "after-exit"]]);
  });

  it("accepts the Monday of the week term starts", () => {
    expect(readAttendance(attendanceFile("STU-0412,2026-06-29,5,6"), context).errors).toEqual([]);
  });
});

describe("readScores", () => {
  it("reads a good file", () => {
    const result = readScores(scoresFile("STU-0412,Unit Test 7,2026-11-01,180,300"), context);
    expect(result.records).toEqual([
      {
        studentId: "id-STU-0412",
        testName: "Unit Test 7",
        takenOn: "2026-11-01",
        score: 180,
        maxScore: 300,
      },
    ]);
  });

  it("treats a row with no marks as an absent student", () => {
    const result = readScores(
      scoresFile("STU-0412,,,,", "STU-0587,Unit Test 7,2026-11-01,180,300"),
      context,
    );
    expect(result.blank).toBe(1);
    expect(result.records).toHaveLength(1);
  });

  it("reports bad marks, names and repeats", () => {
    const result = readScores(
      scoresFile(
        "STU-0412,Unit Test 7,2026-11-01,301,300",
        "STU-0412,Unit Test 7,2026-11-01,-4,300",
        "STU-0412,Unit Test 7,2026-11-01,180,0",
        "STU-0412,Unit Test 7,2026-11-01,180,1001",
        `STU-0412,${"x".repeat(61)},2026-11-01,180,300`,
        "STU-0412,Unit Test 8,2026-11-01,180,300",
        "STU-0412,Unit Test 8,2026-11-01,190,300",
      ),
      context,
    );
    expect(problems(result)).toEqual([
      [2, "score-over-max"],
      [3, "bad-number"],
      [4, "bad-number"],
      [5, "bad-number"],
      [6, "name-too-long"],
      [8, "duplicate"],
    ]);
  });
});

describe("compareWithSaved", () => {
  const record = (weekStart: string, present: number): AttendanceRecord => ({
    studentId: "a",
    weekStart,
    present,
    total: 6,
  });
  const same = (a: AttendanceRecord, b: AttendanceRecord) =>
    a.present === b.present && a.total === b.total;

  it("sorts rows into new, changed and already saved", () => {
    const changes = compareWithSaved(
      [record("2026-11-02", 5), record("2026-10-26", 4), record("2026-10-19", 6)],
      [record("2026-10-26", 3), record("2026-10-19", 6)],
      attendanceKey,
      same,
    );
    expect(changes.map((change) => change.status)).toEqual(["new", "changed", "same"]);
    expect(changes[1].before?.present).toBe(3);
  });
});

describe("templateColumns", () => {
  it("makes a template the reader accepts", () => {
    const header = templateColumns("attendance").join(",");
    const result = readAttendance(`${header}\nSTU-0412,Aarav Meena,2026-11-02,5,6`, context);
    expect(result.errors).toEqual([]);

    const scores = templateColumns("scores").join(",");
    expect(readScores(`${scores}\nSTU-0412,Aarav,Unit 1,2026-11-01,9,10`, context).errors).toEqual([]);
  });
});
