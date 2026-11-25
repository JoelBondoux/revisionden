CREATE TABLE "data_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"logged_by" text NOT NULL,
	"handled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "data_requests_kind_values" CHECK ("data_requests"."kind" in ('export', 'deletion'))
);
--> statement-breakpoint
CREATE INDEX "data_requests_due_idx" ON "data_requests" USING btree ("handled_at","due_at");