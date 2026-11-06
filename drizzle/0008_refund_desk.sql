CREATE SEQUENCE "public"."credit_note_no_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "approved_by" uuid;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "approved_on" date;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "paid_by" uuid;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "paid_on" date;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "paid_method" "payment_method";--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "paid_ref" text;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "credit_note_no" text;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_paid_by_users_id_fk" FOREIGN KEY ("paid_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_credit_note_no_unique" UNIQUE("credit_note_no");--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refund_second_person" CHECK ("refunds"."approved_by" is null or "refunds"."approved_by" <> "refunds"."created_by");