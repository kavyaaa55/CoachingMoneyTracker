import { and, asc, count, desc, eq, ilike, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { instalments, payments, reminders, students, users } from "@/db/schema";
import { addDays, type IsoDate } from "@/domain/dates";
import {
  decideReminders,
  PLAN_AHEAD_DAYS,
  reminderSchedule,
} from "@/domain/reminders";
import { reminderMessage } from "@/i18n";
import { timeOn, today } from "./clock";
import { env } from "./env";
import { errorName, log } from "./log";
import { payLinkFor } from "./pay-links";

export const REMINDERS_PER_PAGE = 25;

/**
 * A real provider takes about 200 ms a message, so one at a time would take 9 minutes on a busy
 * day. Each send holds a row lock and a connection, so this stays below the connection pool.
 */
const SEND_CONCURRENCY = 8;

/** A provider that hangs must not hold the lock on an instalment for ever. */
const SEND_TIMEOUT_MS = 10_000;

function withTimeout(work: Promise<void>, ms: number) {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Send timed out")), ms);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

async function forEachLimited<T>(items: T[], limit: number, work: (item: T) => Promise<void>) {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const item = items[next];
      next += 1;
      await work(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

export type Sender = (message: { phone: string; text: string }) => Promise<void>;
export type RunResult = { sent: number; stopped: number; failed: number };

/** Stands in for an SMS or WhatsApp provider. The brief says to mock messages. */
export const mockSender: Sender = async () => {};

const paidSum = sql<number>`coalesce(sum(${payments.amountPaise}) filter (where ${payments.status} = 'matched'), 0)::int`;

/** Queues every stage for unpaid instalments coming up. Safe to repeat. */
async function planReminders(date: IsoDate) {
  const rows = await db
    .select({
      id: instalments.id,
      dueDate: instalments.dueDate,
      amount: instalments.amountPaise,
      language: users.language,
      paid: paidSum,
    })
    .from(instalments)
    .innerJoin(students, eq(students.id, instalments.studentId))
    .innerJoin(users, eq(users.id, students.parentId))
    .leftJoin(payments, eq(payments.instalmentId, instalments.id))
    .where(
      and(isNull(students.exitDate), lte(instalments.dueDate, addDays(date, PLAN_AHEAD_DAYS))),
    )
    .groupBy(instalments.id, users.id);

  const values = rows
    .filter((row) => row.amount > row.paid)
    .flatMap((row) =>
      reminderSchedule(row.dueDate, date).map(({ dayOffset, sendOn }) => ({
        instalmentId: row.id,
        dayOffset,
        sendOn,
        language: row.language,
      })),
    );

  if (values.length > 0) await db.insert(reminders).values(values).onConflictDoNothing();
}

async function processInstalment(
  instalmentId: string,
  date: IsoDate,
  send: Sender,
  timeoutMs: number,
): Promise<RunResult> {
  return db.transaction(async (tx) => {
    // The same lock recordPayment takes, so a payment cannot slip in during a send,
    // and two runs cannot send the same reminder.
    const [instalment] = await tx
      .select()
      .from(instalments)
      .where(eq(instalments.id, instalmentId))
      .for("update");

    const due = await tx
      .select({ id: reminders.id, dayOffset: reminders.dayOffset })
      .from(reminders)
      .where(
        and(
          eq(reminders.instalmentId, instalmentId),
          eq(reminders.status, "queued"),
          lte(reminders.sendOn, date),
        ),
      );
    if (due.length === 0) return { sent: 0, stopped: 0, failed: 0 };

    const [{ paid }] = await tx
      .select({ paid: sql<number>`coalesce(sum(${payments.amountPaise}), 0)::int` })
      .from(payments)
      .where(and(eq(payments.instalmentId, instalmentId), eq(payments.status, "matched")));
    const balance = Math.max(0, instalment.amountPaise - paid);

    const [recipient] = await tx
      .select({
        studentName: students.name,
        exitDate: students.exitDate,
        phone: users.phone,
        language: users.language,
      })
      .from(students)
      .innerJoin(users, eq(users.id, students.parentId))
      .where(eq(students.id, instalment.studentId));

    const decision = decideReminders(due, balance, recipient.exitDate !== null);

    for (const { id, reason } of decision.stop) {
      await tx
        .update(reminders)
        .set({ status: "stopped", stoppedReason: reason })
        .where(eq(reminders.id, id));
    }

    const stopped = decision.stop.length;
    if (!decision.send) return { sent: 0, stopped, failed: 0 };

    const text = reminderMessage(recipient.language, {
      dayOffset: decision.send.dayOffset,
      studentName: recipient.studentName,
      amount: balance,
      dueDate: instalment.dueDate,
      link: `${env.APP_URL}${payLinkFor(instalmentId)}`,
    });

    try {
      await withTimeout(send({ phone: recipient.phone, text }), timeoutMs);
    } catch (error) {
      // Stays queued, so the next run tries again.
      log("warn", "reminder.send_failed", { instalmentId, error: errorName(error) });
      return { sent: 0, stopped, failed: 1 };
    }

    await tx
      .update(reminders)
      .set({
        status: "sent",
        sentAt: timeOn(date),
        message: text,
        language: recipient.language,
      })
      .where(eq(reminders.id, decision.send.id));

    return { sent: 1, stopped, failed: 0 };
  });
}

/** The daily job, used by the cron route and the "Run reminders" button. */
export async function runReminders(
  date: IsoDate = today(),
  send: Sender = mockSender,
  timeoutMs = SEND_TIMEOUT_MS,
): Promise<RunResult> {
  await planReminders(date);

  const due = await db
    .selectDistinct({ id: reminders.instalmentId })
    .from(reminders)
    .where(and(eq(reminders.status, "queued"), lte(reminders.sendOn, date)));

  const total: RunResult = { sent: 0, stopped: 0, failed: 0 };
  await forEachLimited(due, SEND_CONCURRENCY, async ({ id }) => {
    const result = await processInstalment(id, date, send, timeoutMs);
    total.sent += result.sent;
    total.stopped += result.stopped;
    total.failed += result.failed;
  });
  return total;
}

export const REMINDER_FILTERS = ["all", "queued", "sent", "stopped"] as const;
export type ReminderFilter = (typeof REMINDER_FILTERS)[number];

type ListOptions = { filter: ReminderFilter; search: string; page: number };

const likePattern = (text: string) => `%${text.replace(/[\\%_]/g, "\\$&")}%`;

export async function listReminders({ filter, search, page }: ListOptions) {
  const pattern = likePattern(search);
  const matchesSearch = search
    ? or(ilike(students.name, pattern), ilike(students.code, pattern))
    : undefined;

  const [rows, totals] = await Promise.all([
    db
      .select({
        id: reminders.id,
        studentId: students.id,
        studentName: students.name,
        studentCode: students.code,
        sequence: instalments.sequence,
        dayOffset: reminders.dayOffset,
        sendOn: reminders.sendOn,
        language: reminders.language,
        status: reminders.status,
        stoppedReason: reminders.stoppedReason,
        message: reminders.message,
      })
      .from(reminders)
      .innerJoin(instalments, eq(instalments.id, reminders.instalmentId))
      .innerJoin(students, eq(students.id, instalments.studentId))
      .where(and(filter === "all" ? undefined : eq(reminders.status, filter), matchesSearch))
      .orderBy(
        filter === "queued" ? asc(reminders.sendOn) : desc(reminders.sendOn),
        asc(students.name),
        asc(reminders.dayOffset),
      )
      .limit(REMINDERS_PER_PAGE)
      .offset((page - 1) * REMINDERS_PER_PAGE),
    db
      .select({ status: reminders.status, total: count() })
      .from(reminders)
      .innerJoin(instalments, eq(instalments.id, reminders.instalmentId))
      .innerJoin(students, eq(students.id, instalments.studentId))
      .where(matchesSearch)
      .groupBy(reminders.status),
  ]);

  const counts = { all: 0, queued: 0, sent: 0, stopped: 0 };
  for (const { status, total } of totals) {
    counts[status] = total;
    counts.all += total;
  }

  return { rows, counts };
}
