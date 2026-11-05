CREATE TYPE "public"."language" AS ENUM('en', 'hi');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('matched', 'unmatched');--> statement-breakpoint
CREATE TYPE "public"."refund_status" AS ENUM('calculated', 'approved', 'paid');--> statement-breakpoint
CREATE TYPE "public"."reminder_status" AS ENUM('queued', 'sent', 'stopped');--> statement-breakpoint
CREATE TYPE "public"."risk_band" AS ENUM('watch', 'high');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('parent', 'accounts');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('open', 'called', 'false_flag');--> statement-breakpoint
CREATE TABLE "attendance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"week_start" date NOT NULL,
	"present" integer NOT NULL,
	"total" integer NOT NULL,
	CONSTRAINT "attendance_student_id_week_start_unique" UNIQUE("student_id","week_start"),
	CONSTRAINT "attendance_valid" CHECK ("attendance"."present" between 0 and "attendance"."total")
);
--> statement-breakpoint
CREATE TABLE "batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"centre_id" uuid NOT NULL,
	CONSTRAINT "batches_centre_id_name_unique" UNIQUE("centre_id","name")
);
--> statement-breakpoint
CREATE TABLE "centres" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "centres_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"parent_id" uuid NOT NULL,
	"notice_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "consents_student_id_parent_id_notice_version_unique" UNIQUE("student_id","parent_id","notice_version")
);
--> statement-breakpoint
CREATE TABLE "instalments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"due_date" date NOT NULL,
	"amount_paise" integer NOT NULL,
	CONSTRAINT "instalments_student_id_sequence_unique" UNIQUE("student_id","sequence"),
	CONSTRAINT "instalment_amount_positive" CHECK ("instalments"."amount_paise" > 0)
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gateway_ref" text NOT NULL,
	"instalment_id" uuid,
	"amount_paise" integer NOT NULL,
	"status" "payment_status" NOT NULL,
	"receipt_no" text,
	"paid_at" timestamp with time zone NOT NULL,
	CONSTRAINT "payments_gateway_ref_unique" UNIQUE("gateway_ref"),
	CONSTRAINT "payments_receipt_no_unique" UNIQUE("receipt_no"),
	CONSTRAINT "payment_amount_positive" CHECK ("payments"."amount_paise" > 0),
	CONSTRAINT "matched_has_instalment" CHECK (("payments"."status" = 'matched') = ("payments"."instalment_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"exit_date" date NOT NULL,
	"term_days" integer NOT NULL,
	"days_used" integer NOT NULL,
	"fee_used_paise" integer NOT NULL,
	"refund_paise" integer NOT NULL,
	"due_by" date NOT NULL,
	"status" "refund_status" DEFAULT 'calculated' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refunds_student_id_unique" UNIQUE("student_id")
);
--> statement-breakpoint
CREATE TABLE "reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instalment_id" uuid NOT NULL,
	"day_offset" integer NOT NULL,
	"language" "language" NOT NULL,
	"status" "reminder_status" DEFAULT 'queued' NOT NULL,
	"send_on" date NOT NULL,
	"sent_at" timestamp with time zone,
	CONSTRAINT "reminders_instalment_id_day_offset_unique" UNIQUE("instalment_id","day_offset")
);
--> statement-breakpoint
CREATE TABLE "risk_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"band" "risk_band" NOT NULL,
	"reasons" jsonb NOT NULL,
	"task_status" "task_status" DEFAULT 'open' NOT NULL,
	"review_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"batch_id" uuid NOT NULL,
	"parent_id" uuid NOT NULL,
	"plan_total_paise" integer NOT NULL,
	"discount_paise" integer DEFAULT 0 NOT NULL,
	"term_start" date NOT NULL,
	"term_end" date NOT NULL,
	"exit_date" date,
	CONSTRAINT "students_code_unique" UNIQUE("code"),
	CONSTRAINT "discount_within_plan" CHECK ("students"."discount_paise" between 0 and "students"."plan_total_paise")
);
--> statement-breakpoint
CREATE TABLE "test_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"test_name" text NOT NULL,
	"taken_on" date NOT NULL,
	"score" integer NOT NULL,
	"max_score" integer NOT NULL,
	CONSTRAINT "test_scores_student_id_test_name_unique" UNIQUE("student_id","test_name"),
	CONSTRAINT "score_valid" CHECK ("test_scores"."score" between 0 and "test_scores"."max_score")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"name" text NOT NULL,
	"role" "role" NOT NULL,
	"language" "language" DEFAULT 'en' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batches" ADD CONSTRAINT "batches_centre_id_centres_id_fk" FOREIGN KEY ("centre_id") REFERENCES "public"."centres"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_parent_id_users_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instalments" ADD CONSTRAINT "instalments_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_instalment_id_instalments_id_fk" FOREIGN KEY ("instalment_id") REFERENCES "public"."instalments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_instalment_id_instalments_id_fk" FOREIGN KEY ("instalment_id") REFERENCES "public"."instalments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_flags" ADD CONSTRAINT "risk_flags_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_parent_id_users_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_scores" ADD CONSTRAINT "test_scores_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "instalments_due_date_index" ON "instalments" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "payments_instalment_id_index" ON "payments" USING btree ("instalment_id");--> statement-breakpoint
CREATE INDEX "reminders_status_send_on_index" ON "reminders" USING btree ("status","send_on");--> statement-breakpoint
CREATE INDEX "risk_flags_student_id_index" ON "risk_flags" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "risk_flags_task_status_index" ON "risk_flags" USING btree ("task_status");--> statement-breakpoint
CREATE INDEX "students_batch_id_index" ON "students" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "students_parent_id_index" ON "students" USING btree ("parent_id");