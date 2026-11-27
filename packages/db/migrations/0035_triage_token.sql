ALTER TABLE "feedback" ADD COLUMN "reviewed_by" text;--> statement-breakpoint
ALTER TABLE "operator_audit_log" ADD COLUMN "reason" text;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_reviewed_by_values" CHECK ("feedback"."reviewed_by" in ('operator', 'triage'));--> statement-breakpoint
ALTER TABLE "operator_audit_log" ADD CONSTRAINT "operator_audit_log_reason_length" CHECK (char_length("operator_audit_log"."reason") <= 300);