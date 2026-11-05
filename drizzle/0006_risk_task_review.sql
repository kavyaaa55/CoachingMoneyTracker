ALTER TABLE "risk_flags" ADD COLUMN "flagged_on" date NOT NULL;--> statement-breakpoint
ALTER TABLE "risk_flags" ADD COLUMN "reviewed_on" date;--> statement-breakpoint
ALTER TABLE "risk_flags" ADD COLUMN "reviewed_by" uuid;--> statement-breakpoint
ALTER TABLE "risk_flags" ADD CONSTRAINT "risk_flags_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "risk_flags_one_open_task" ON "risk_flags" USING btree ("student_id") WHERE "risk_flags"."task_status" = 'open';