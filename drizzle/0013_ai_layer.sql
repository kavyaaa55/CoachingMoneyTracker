ALTER TABLE "payments" ADD COLUMN "payer_note" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "note_hints" jsonb;--> statement-breakpoint
ALTER TABLE "risk_flags" ADD COLUMN "call_brief" text;--> statement-breakpoint
ALTER TABLE "risk_flags" ADD COLUMN "brief_source" text;