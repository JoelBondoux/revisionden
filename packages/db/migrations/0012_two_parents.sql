CREATE TABLE "family_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seq" integer GENERATED ALWAYS AS IDENTITY (sequence name "family_events_seq_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"family_id" uuid NOT NULL,
	"actor_position" integer,
	"kind" text NOT NULL,
	"student_id" uuid,
	"important" boolean DEFAULT false NOT NULL,
	"pushed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parent_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"created_by_parent_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "parent_invites_code_hash_unique" UNIQUE("code_hash")
);
--> statement-breakpoint
CREATE TABLE "parent_removal_notices" (
	"auth_user_id" text PRIMARY KEY NOT NULL,
	"removed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "families" ADD COLUMN "deletion_requested_by" integer;--> statement-breakpoint
ALTER TABLE "families" ADD COLUMN "deletion_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "parents" ADD COLUMN "position" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "parents" ADD COLUMN "events_seen_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "family_events" ADD CONSTRAINT "family_events_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_events" ADD CONSTRAINT "family_events_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_invites" ADD CONSTRAINT "parent_invites_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_invites" ADD CONSTRAINT "parent_invites_created_by_parent_id_parents_id_fk" FOREIGN KEY ("created_by_parent_id") REFERENCES "public"."parents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_removal_notices" ADD CONSTRAINT "parent_removal_notices_auth_user_id_auth_users_id_fk" FOREIGN KEY ("auth_user_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "family_events_family_id_idx" ON "family_events" USING btree ("family_id","created_at");--> statement-breakpoint
CREATE INDEX "parent_invites_family_id_idx" ON "parent_invites" USING btree ("family_id");--> statement-breakpoint
ALTER TABLE "parents" ADD CONSTRAINT "parents_family_position_unique" UNIQUE("family_id","position");--> statement-breakpoint
ALTER TABLE "parents" ADD CONSTRAINT "parents_position_range" CHECK ("parents"."position" in (1, 2));