import { daysBetween, type IsoDate } from "./dates";
import { balanceOf, type Instalment } from "./instalments";
import type { Paise } from "./money";

export const AGEING_BUCKETS = ["upTo30", "upTo60", "over60"] as const;
export type AgeingBucket = (typeof AGEING_BUCKETS)[number];

/** Assumption, see CLAUDE.md: 0-30, 31-60 and 60+ days, matching the brief's 60 day measure. */
export function ageingBucket(daysOverdue: number): AgeingBucket | null {
  if (daysOverdue <= 0) return null;
  if (daysOverdue <= 30) return "upTo30";
  return daysOverdue <= 60 ? "upTo60" : "over60";
}

export type DuesInstalment = Instalment & { studentId: string };

export type DuesSummary = {
  students: number;
  billed: Paise;
  collected: Paise;
  /** Everything unpaid, whether or not it has fallen due. */
  outstanding: Paise;
  /** The part of outstanding past its due date. */
  overdue: Paise;
  ageing: Record<AgeingBucket, { amount: Paise; students: number }>;
};

export function summariseDues(instalments: DuesInstalment[], today: IsoDate): DuesSummary {
  const students = new Set<string>();
  const late = { upTo30: new Set<string>(), upTo60: new Set<string>(), over60: new Set<string>() };
  const amounts = { upTo30: 0, upTo60: 0, over60: 0 };
  let billed = 0;
  let collected = 0;
  let outstanding = 0;

  for (const instalment of instalments) {
    const balance = balanceOf(instalment);
    students.add(instalment.studentId);
    billed += instalment.amount;
    collected += instalment.paid;
    outstanding += balance;

    const bucket = ageingBucket(daysBetween(instalment.dueDate, today));
    if (bucket && balance > 0) {
      amounts[bucket] += balance;
      late[bucket].add(instalment.studentId);
    }
  }

  const entry = (bucket: AgeingBucket) => ({ amount: amounts[bucket], students: late[bucket].size });

  return {
    students: students.size,
    billed,
    collected,
    outstanding,
    overdue: amounts.upTo30 + amounts.upTo60 + amounts.over60,
    ageing: { upTo30: entry("upTo30"), upTo60: entry("upTo60"), over60: entry("over60") },
  };
}

export type BatchInstalment = DuesInstalment & { batchId: string; batch: string; centre: string };

/** One row per batch at each centre, because the same batch name runs at several centres. */
export function duesByBatch(instalments: BatchInstalment[], today: IsoDate) {
  const groups = new Map<string, BatchInstalment[]>();
  for (const instalment of instalments) {
    groups.set(instalment.batchId, [...(groups.get(instalment.batchId) ?? []), instalment]);
  }

  return [...groups.values()]
    .map((rows) => {
      const { batchId, batch, centre } = rows[0];
      return { batchId, batch, centre, ...summariseDues(rows, today) };
    })
    .sort((a, b) => a.centre.localeCompare(b.centre) || a.batch.localeCompare(b.batch));
}
