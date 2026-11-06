ALTER TABLE "risk_flags" ADD COLUMN "decided_by" text DEFAULT 'rules' NOT NULL;--> statement-breakpoint
ALTER TABLE "risk_flags" ADD COLUMN "rule_band" "risk_band";--> statement-breakpoint
ALTER TABLE "risk_flags" ADD COLUMN "ai_why" text;