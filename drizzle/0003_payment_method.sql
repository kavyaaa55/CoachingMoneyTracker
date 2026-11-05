CREATE TYPE "public"."payment_method" AS ENUM('gateway', 'cash', 'upi', 'cheque', 'bank_transfer');--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "method" "payment_method" DEFAULT 'gateway' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "external_ref" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "recorded_by" uuid;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;