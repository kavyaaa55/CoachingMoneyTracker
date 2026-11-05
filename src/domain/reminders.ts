import { addDays, daysBetween, type IsoDate } from "./dates";
import type { Paise } from "./money";

const every = (step: number, from: number, to: number) =>
  Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, index) => from + index * step);

/**
 * Assumption, see CLAUDE.md. The brief says before, on and after each due date, and to stop
 * when someone pays. So overdue reminders carry on: weekly past the client's 60 day measure,
 * then every 4 weeks for the rest of the year, so a parent is not chased forever.
 */
export const REMINDER_OFFSETS = [-7, -1, 0, 3, ...every(7, 7, 63), ...every(28, 91, 364)];

/** Reminders are queued this long before a due date, so staff can see what is coming. */
export const PLAN_AHEAD_DAYS = 14;

export type ReminderStage = "before" | "on" | "after";
export type StopReason = "paid" | "superseded" | "student-left";

export function stageOf(dayOffset: number): ReminderStage {
  if (dayOffset === 0) return "on";
  return dayOffset < 0 ? "before" : "after";
}

/** The stages sent by now or coming up soon. Later ones are queued as they get close. */
export const reminderSchedule = (dueDate: IsoDate, today: IsoDate) =>
  REMINDER_OFFSETS.map((dayOffset) => ({ dayOffset, sendOn: addDays(dueDate, dayOffset) })).filter(
    ({ sendOn }) => daysBetween(today, sendOn) <= PLAN_AHEAD_DAYS,
  );

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
