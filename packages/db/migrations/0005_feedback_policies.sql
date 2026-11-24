CREATE TABLE "feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"sender_role" text NOT NULL,
	"student_id" uuid,
	"sender_auth_user_id" text,
	"kind" text NOT NULL,
	"text" text,
	"device" jsonb,
	"status" text DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	CONSTRAINT "feedback_kind_values" CHECK ("feedback"."kind" in ('bug', 'idea', 'confusing', 'other')),
	CONSTRAINT "feedback_sender_role_values" CHECK ("feedback"."sender_role" in ('student', 'parent')),
	CONSTRAINT "feedback_status_values" CHECK ("feedback"."status" in ('new', 'looking_into_it', 'fixed', 'will_not_fix')),
	CONSTRAINT "feedback_text_length" CHECK (char_length("feedback"."text") <= 500)
);
--> statement-breakpoint
CREATE TABLE "policy_acceptances" (
	"auth_user_id" text NOT NULL,
	"policy" text NOT NULL,
	"version" text NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "policy_acceptances_auth_user_id_policy_pk" PRIMARY KEY("auth_user_id","policy")
);
--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_sender_auth_user_id_auth_users_id_fk" FOREIGN KEY ("sender_auth_user_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_acceptances" ADD CONSTRAINT "policy_acceptances_auth_user_id_auth_users_id_fk" FOREIGN KEY ("auth_user_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feedback_family_id_idx" ON "feedback" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "feedback_created_at_idx" ON "feedback" USING btree ("created_at");