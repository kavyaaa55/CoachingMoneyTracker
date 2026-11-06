ALTER TYPE "public"."payment_status" ADD VALUE 'returned';--> statement-breakpoint
ALTER TABLE "payments" DROP CONSTRAINT "unmatched_has_no_instalment";--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "applied_has_instalment" CHECK (("payments"."status" in ('matched', 'reversed')) = ("payments"."instalment_id" is not null));