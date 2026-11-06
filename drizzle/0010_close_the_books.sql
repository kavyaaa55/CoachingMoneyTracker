ALTER TYPE "public"."payment_status" ADD VALUE 'reversed';--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "month_closes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"month" text NOT NULL,
	"closed_on" date NOT NULL,
	"closed_by" uuid NOT NULL,
	CONSTRAINT "month_closes_month_unique" UNIQUE("month")
);
--> statement-breakpoint
ALTER TABLE "payments" DROP CONSTRAINT "matched_has_instalment";--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "applied_by" uuid;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "reversed_by" uuid;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "reversed_on" date;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "reversal_note" text;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "month_closes" ADD CONSTRAINT "month_closes_closed_by_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_events_at_index" ON "audit_events" USING btree ("at");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_applied_by_users_id_fk" FOREIGN KEY ("applied_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_reversed_by_users_id_fk" FOREIGN KEY ("reversed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "unmatched_has_no_instalment" CHECK (("payments"."status" = 'unmatched') = ("payments"."instalment_id" is null));