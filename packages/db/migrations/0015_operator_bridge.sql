CREATE TABLE "operator_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operator_email" text NOT NULL,
	"operator_role" text NOT NULL,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"request_id" text NOT NULL,
	"outcome" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "operator_audit_log_role_values" CHECK ("operator_audit_log"."operator_role" in ('agent', 'manager')),
	CONSTRAINT "operator_audit_log_outcome_values" CHECK ("operator_audit_log"."outcome" in ('ok', 'denied'))
);
--> statement-breakpoint
CREATE TABLE "operator_requests" (
	"request_id" text PRIMARY KEY NOT NULL,
	"method" text NOT NULL,
	"path" text NOT NULL,
	"body_hash" text NOT NULL,
	"response_status" integer,
	"response_body" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "operator_audit_log_created_at_idx" ON "operator_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "operator_audit_log_target_idx" ON "operator_audit_log" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "operator_requests_created_at_idx" ON "operator_requests" USING btree ("created_at");