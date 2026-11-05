CREATE SEQUENCE "public"."receipt_no_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "claimed_ref" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "unmatched_reason" text;