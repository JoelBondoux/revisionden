CREATE TABLE "item_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" text NOT NULL,
	"item_version" integer NOT NULL,
	"reason" text NOT NULL,
	"reported_by" text NOT NULL,
	"family_id" uuid NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"decided_by_role" text,
	"decision_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	CONSTRAINT "item_reports_version_positive" CHECK ("item_reports"."item_version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "quarantined_items" (
	"item_id" text PRIMARY KEY NOT NULL,
	"item_version" integer NOT NULL,
	"cause" text NOT NULL,
	"since" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recalculation_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" text NOT NULL,
	"item_version" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "recheck_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" text NOT NULL,
	"scope_value" text NOT NULL,
	"cause" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "review_batch_items" (
	"batch_id" uuid NOT NULL,
	"item_id" text NOT NULL,
	"item_version" integer NOT NULL,
	"needs_human_approval" boolean DEFAULT false NOT NULL,
	"in_sample" boolean NOT NULL,
	"snapshot" jsonb NOT NULL,
	"decision" text,
	"decided_by_role" text,
	"decision_notes" text,
	"decided_at" timestamp with time zone,
	CONSTRAINT "review_batch_items_batch_id_item_id_pk" PRIMARY KEY("batch_id","item_id")
);
--> statement-breakpoint
CREATE TABLE "review_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"writer_prompt" text,
	"source_url" text,
	"status" text DEFAULT 'in_review' NOT NULL,
	"sample_seed" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "reviewer_roles" (
	"auth_user_id" text PRIMARY KEY NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviewer_roles_role_values" CHECK ("reviewer_roles"."role" in ('subject-specialist', 'content-lead', 'parent-reviewer'))
);
--> statement-breakpoint
ALTER TABLE "item_reports" ADD CONSTRAINT "item_reports_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_batch_items" ADD CONSTRAINT "review_batch_items_batch_id_review_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."review_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviewer_roles" ADD CONSTRAINT "reviewer_roles_auth_user_id_auth_users_id_fk" FOREIGN KEY ("auth_user_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "item_reports_item_idx" ON "item_reports" USING btree ("item_id","status");