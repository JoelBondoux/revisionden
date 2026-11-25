CREATE TABLE "error_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ref" text NOT NULL,
	"screen" text NOT NULL,
	"api_path" text,
	"status" integer,
	"build" text NOT NULL,
	"browser" text NOT NULL,
	"online" boolean NOT NULL,
	"reported_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "error_reports_ref_unique" UNIQUE("ref"),
	CONSTRAINT "error_reports_browser_values" CHECK ("error_reports"."browser" in ('Chrome', 'Edge', 'Firefox', 'Safari', 'Other'))
);
--> statement-breakpoint
CREATE INDEX "error_reports_created_at_idx" ON "error_reports" USING btree ("created_at");