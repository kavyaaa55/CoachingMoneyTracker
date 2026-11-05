import { addDays, daysBetween, type IsoDate } from "./dates";
import type { Paise } from "./money";

/** Assumption, see CLAUDE.md. The brief says before, on and after each due date. */
export const REMINDER_OFFSETS = [-7, -1, 0, 3, 7] as const;

/** Reminders are queued this long before a due date, so staff can see what is coming. */
export const PLAN_AHEAD_DAYS = 14;

export type ReminderStage = "before" | "on" | "after";
export type StopReason = "paid" | "superseded" | "student-left";

export function stageOf(dayOffset: number): ReminderStage {
  if (dayOffset === 0) return "on";
  return dayOffset < 0 ? "before" : "after";
}

export const reminderSchedule = (dueDate: IsoDate) =>
  REMINDER_OFFSETS.map((dayOffset) => ({ dayOffset, sendOn: addDays(dueDate, dayOffset) }));

export const shouldPlan = (dueDate: IsoDate, today: IsoDate) =>
  daysBetween(today, dueDate) <= PLAN_AHEAD_DAYS;

type DueReminder = { id: string; dayOffset: number };

export type ReminderDecision = {
  send: DueReminder | null;
  stop: { id: string; reason: StopReason }[];
};

/**
 * Decides what to do with the reminders due for one instalment, at the moment of sending.
 * If the job missed some days, only the latest stage goes out, so a parent never gets
 * several messages at once.
 */
export function decideReminders(
  due: DueReminder[],
  balance: Paise,
  studentHasLeft: boolean,
): ReminderDecision {
  if (studentHasLeft || balance === 0) {
    const reason = studentHasLeft ? "student-left" : "paid";
    return { send: null, stop: due.map(({ id }) => ({ id, reason })) };
  }

  const [latest, ...older] = [...due].sort((a, b) => b.dayOffset - a.dayOffset);
  return {
    send: latest ?? null,
    stop: older.map(({ id }) => ({ id, reason: "superseded" })),
  };
}
