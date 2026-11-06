import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgSequence,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { DraftSource, NoteHints } from "@/domain/ai";
import type { PipelineCounts, PipelineSource } from "@/domain/pipeline";
import type { AuditAction } from "@/lib/audit";
import type { RiskReason } from "@/domain/risk";

export const roleEnum = pgEnum("role", ["parent", "accounts"]);
export const languageEnum = pgEnum("language", ["en", "hi"]);
export const paymentMethodEnum = pgEnum("payment_method", [
  "gateway",
  "cash",
  "upi",
  "cheque",
  "bank_transfer",
]);
export const paymentStatusEnum = pgEnum("payment_status", [
  "matched",
  "unmatched",
  "reversed",
  "returned",
]);
export const reminderStatusEnum = pgEnum("reminder_status", ["queued", "sent", "stopped"]);
export const riskBandEnum = pgEnum("risk_band", ["watch", "high"]);
export const taskStatusEnum = pgEnum("task_status", ["open", "called", "false_flag"]);
export const refundStatusEnum = pgEnum("refund_status", ["calculated", "approved", "paid"]);

/** One series of receipt numbers. A rolled-back payment can leave a gap, which month end reports. */
export const receiptNoSeq = pgSequence("receipt_no_seq");
export const creditNoteNoSeq = pgSequence("credit_note_no_seq");

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

/** Only a hash of the code is stored. */
export const otpCodes = pgTable(
  "otp_codes",
  {
    id: id(),
    phone: text("phone").notNull(),
    codeHash: text("code_hash").notNull(),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.phone, t.createdAt)],
);

export const centres = pgTable("centres", {
  id: id(),
  name: text("name").notNull().unique(),
});

export const batches = pgTable(
  "batches",
  {
    id: id(),
    name: text("name").notNull(),
    centreId: uuid("centre_id")
      .notNull()
      .references(() => centres.id),
  },
  (t) => [unique().on(t.centreId, t.name)],
);

export const users = pgTable("users", {
  id: id(),
  phone: text("phone").notNull().unique(),
  name: text("name").notNull(),
  role: roleEnum("role").notNull(),
  language: languageEnum("language").notNull().default("en"),
  createdAt: createdAt(),
});

export const students = pgTable(
  "students",
  {
    id: id(),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => batches.id),
    parentId: uuid("parent_id")
      .notNull()
      .references(() => users.id),
    planTotalPaise: integer("plan_total_paise").notNull(),
    discountPaise: integer("discount_paise").notNull().default(0),
    termStart: date("term_start").notNull(),
    termEnd: date("term_end").notNull(),
    exitDate: date("exit_date"),
  },
  (t) => [
    index().on(t.batchId),
    index().on(t.parentId),
    check("discount_within_plan", sql`${t.discountPaise} between 0 and ${t.planTotalPaise}`),
  ],
);

/** Verifiable parental consent, required by the DPDP Act 2023. */
export const consents = pgTable(
  "consents",
  {
    id: id(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id),
    parentId: uuid("parent_id")
      .notNull()
      .references(() => users.id),
    noticeVersion: text("notice_version").notNull(),
    givenAt: createdAt(),
  },
  (t) => [unique().on(t.studentId, t.parentId, t.noticeVersion)],
);

export const instalments = pgTable(
  "instalments",
  {
    id: id(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id),
    sequence: integer("sequence").notNull(),
    dueDate: date("due_date").notNull(),
    amountPaise: integer("amount_paise").notNull(),
  },
  (t) => [
    unique().on(t.studentId, t.sequence),
    index().on(t.dueDate),
    check("instalment_amount_positive", sql`${t.amountPaise} > 0`),
  ],
);

/** A payment that cannot be matched stays unmatched and marks nothing paid. */
export const payments = pgTable(
  "payments",
  {
    id: id(),
    gatewayRef: text("gateway_ref").notNull().unique(),
    instalmentId: uuid("instalment_id").references(() => instalments.id),
    amountPaise: integer("amount_paise").notNull(),
    status: paymentStatusEnum("status").notNull(),
    method: paymentMethodEnum("method").notNull().default("gateway"),
    /** A cheque, UPI or bank reference typed by staff. */
    externalRef: text("external_ref"),
    /** The staff member who entered it. Empty for gateway payments. */
    recordedBy: uuid("recorded_by").references(() => users.id),
    receiptNo: text("receipt_no").unique(),
    /** What the gateway claimed, kept so staff can resolve an unmatched payment. */
    claimedRef: text("claimed_ref"),
    unmatchedReason: text("unmatched_reason"),
    paidAt: timestamp("paid_at", { withTimezone: true }).notNull(),
    /** What the payer wrote, and what the model read from it. Hints only suggest. */
    payerNote: text("payer_note"),
    noteHints: jsonb("note_hints").$type<NoteHints>(),
    /** The person who applied this from the queue. */
    appliedBy: uuid("applied_by").references(() => users.id),
    /** A wrong payment is never deleted. The row and its receipt stay, marked reversed. */
    /** Queued money sent back to the payer uses these too, marked returned. */
    reversedBy: uuid("reversed_by").references(() => users.id),
    reversedOn: date("reversed_on"),
    reversalNote: text("reversal_note"),
  },
  (t) => [
    index().on(t.instalmentId),
    check("payment_amount_positive", sql`${t.amountPaise} > 0`),
    check(
      "applied_has_instalment",
      sql`(${t.status} in ('matched', 'reversed')) = (${t.instalmentId} is not null)`,
    ),
  ],
);

export const reminders = pgTable(
  "reminders",
  {
    id: id(),
    instalmentId: uuid("instalment_id")
      .notNull()
      .references(() => instalments.id),
    /** Days from the due date: -7 is a week before, 3 is three days after. */
    dayOffset: integer("day_offset").notNull(),
    language: languageEnum("language").notNull(),
    status: reminderStatusEnum("status").notNull().default("queued"),
    sendOn: date("send_on").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    /** The text as sent, kept as a record. */
    message: text("message"),
    stoppedReason: text("stopped_reason"),
  },
  (t) => [unique().on(t.instalmentId, t.dayOffset), index().on(t.status, t.sendOn)],
);

export const attendance = pgTable(
  "attendance",
  {
    id: id(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id),
    weekStart: date("week_start").notNull(),
    present: integer("present").notNull(),
    total: integer("total").notNull(),
  },
  (t) => [
    unique().on(t.studentId, t.weekStart),
    check("attendance_valid", sql`${t.present} between 0 and ${t.total}`),
  ],
);

export const testScores = pgTable(
  "test_scores",
  {
    id: id(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id),
    testName: text("test_name").notNull(),
    takenOn: date("taken_on").notNull(),
    score: integer("score").notNull(),
    maxScore: integer("max_score").notNull(),
  },
  (t) => [
    unique().on(t.studentId, t.testName),
    check("score_valid", sql`${t.score} between 0 and ${t.maxScore}`),
  ],
);

/** The flag only ever creates this call task. It has no link to fees or messages. */
export const riskFlags = pgTable(
  "risk_flags",
  {
    id: id(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id),
    band: riskBandEnum("band").notNull(),
    /** Stored as facts, so each language can word them on screen. */
    reasons: jsonb("reasons").$type<RiskReason[]>().notNull(),
    taskStatus: taskStatusEnum("task_status").notNull().default("open"),
    reviewNote: text("review_note"),
    ruleVersion: text("rule_version").notNull().default("v1"),
    /** A guide for the call, drafted by the model or taken from the template. */
    callBrief: text("call_brief"),
    briefSource: text("brief_source").$type<DraftSource>(),
    flaggedOn: date("flagged_on").notNull(),
    reviewedOn: date("reviewed_on"),
    reviewedBy: uuid("reviewed_by").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [
    index().on(t.studentId),
    index().on(t.taskStatus),
    // One open task per student, even if two runs overlap.
    uniqueIndex("risk_flags_one_open_task").on(t.studentId).where(sql`${t.taskStatus} = 'open'`),
  ],
);

/** Append only: a database trigger refuses every update and delete. */
export const auditEvents = pgTable(
  "audit_events",
  {
    id: id(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    actorId: uuid("actor_id").references(() => users.id),
    action: text("action").$type<AuditAction>().notNull(),
    entityId: uuid("entity_id").notNull(),
    detail: jsonb("detail").$type<Record<string, unknown>>().notNull().default({}),
  },
  (t) => [index().on(t.at)],
);

export const monthCloses = pgTable("month_closes", {
  id: id(),
  month: text("month").notNull().unique(),
  closedOn: date("closed_on").notNull(),
  closedBy: uuid("closed_by")
    .notNull()
    .references(() => users.id),
});

/** What each day's pipeline run took in and did, so staff can see that it ran. */
export const pipelineRuns = pgTable(
  "pipeline_runs",
  {
    id: id(),
    runOn: date("run_on").notNull(),
    source: text("source").$type<PipelineSource>().notNull(),
    counts: jsonb("counts").$type<PipelineCounts>().notNull(),
    /** The stages that failed. A failed stage does not stop the others. */
    failed: jsonb("failed").$type<string[]>().notNull().default([]),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.runOn)],
);

export const refunds = pgTable(
  "refunds",
  {
    id: id(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id),
    exitDate: date("exit_date").notNull(),
    /** The figures used on the day, so the working stays true if anything changes later. */
    netFeePaise: integer("net_fee_paise").notNull(),
    paidPaise: integer("paid_paise").notNull(),
    termDays: integer("term_days").notNull(),
    daysUsed: integer("days_used").notNull(),
    feeUsedPaise: integer("fee_used_paise").notNull(),
    refundPaise: integer("refund_paise").notNull(),
    dueBy: date("due_by").notNull(),
    status: refundStatusEnum("status").notNull().default("calculated"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
    approvedBy: uuid("approved_by").references(() => users.id),
    approvedOn: date("approved_on"),
    paidBy: uuid("paid_by").references(() => users.id),
    paidOn: date("paid_on"),
    paidMethod: paymentMethodEnum("paid_method"),
    paidRef: text("paid_ref"),
    creditNoteNo: text("credit_note_no").unique(),
  },
  (t) => [
    unique().on(t.studentId),
    // The database itself refuses a person approving their own refund.
    check("refund_second_person", sql`${t.approvedBy} is null or ${t.approvedBy} <> ${t.createdBy}`),
  ],
);
