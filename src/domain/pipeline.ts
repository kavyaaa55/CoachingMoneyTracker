import type { IsoDate } from "./dates";
import type { Paise } from "./money";
import type { UploadKind } from "./upload";

/** Where a run came from. Replay and time machine only exist in demo mode. */
export type PipelineSource = "cron" | "staff" | "replay" | "time-machine";

export type InstalmentRef = { code: string; sequence: number };

/**
 * Everything that reaches the system from outside. Production has the same sources: the gateway
 * webhook, the counter, a centre's CSV and a student leaving. Each goes to the code that real
 * event uses, so a replayed day and a live day cannot behave differently.
 */
export type PipelineEvent = { on: IsoDate } & (
  | { kind: "gateway"; gatewayRef: string; instalment: InstalmentRef | null; amount: Paise }
  | { kind: "counter"; gatewayRef: string; instalment: InstalmentRef; amount: Paise }
  | { kind: "upload"; centre: string; batch: string; file: UploadKind; text: string }
  | { kind: "exit"; code: string }
  | { kind: "refund-approved"; code: string }
  | { kind: "refund-paid"; code: string; reference: string }
  | { kind: "reversal"; gatewayRef: string; note: string }
  | { kind: "month-closed"; month: string }
);

export type PipelineCounts = {
  paymentsMatched: number;
  paymentsQueued: number;
  recordsUploaded: number;
  uploadsRejected: number;
  studentsLeft: number;
  remindersSent: number;
  remindersStopped: number;
  remindersFailed: number;
  tasksCreated: number;
  /** All stopped so far. A payment stops reminders at once, so the job alone would miss them. */
  stoppedSoFar: number;
};

export const emptyCounts = (): PipelineCounts => ({
  paymentsMatched: 0,
  paymentsQueued: 0,
  recordsUploaded: 0,
  uploadsRejected: 0,
  studentsLeft: 0,
  remindersSent: 0,
  remindersStopped: 0,
  remindersFailed: 0,
  tasksCreated: 0,
  stoppedSoFar: 0,
});

export function addCounts(a: PipelineCounts, b: Partial<PipelineCounts>): PipelineCounts {
  const total = { ...a };
  for (const key of Object.keys(total) as (keyof PipelineCounts)[]) total[key] += b[key] ?? 0;
  return total;
}

/** Events arrive in this order within a day, so an upload is saved before a student leaves. */
const ORDER: PipelineEvent["kind"][] = [
  "upload",
  "counter",
  "gateway",
  "reversal",
  "exit",
  "refund-approved",
  "refund-paid",
  "month-closed",
];

export const inDayOrder = (events: PipelineEvent[]) =>
  [...events].sort(
    (a, b) => a.on.localeCompare(b.on) || ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind),
  );
