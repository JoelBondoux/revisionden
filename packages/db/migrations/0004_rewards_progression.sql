CREATE TABLE "parent_rewards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"title" text NOT NULL,
	"target_kind" text NOT NULL,
	"reward_id" text,
	"stat" text,
	"at_least" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"given_at" timestamp with time zone,
	CONSTRAINT "parent_rewards_target" CHECK (("parent_rewards"."target_kind" = 'reward' and "parent_rewards"."reward_id" is not null) or ("parent_rewards"."target_kind" = 'stat' and "parent_rewards"."stat" is not null and "parent_rewards"."at_least" >= 1))
);
--> statement-breakpoint
ALTER TABLE "parent_rewards" ADD CONSTRAINT "parent_rewards_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "parent_rewards_student_idx" ON "parent_rewards" USING btree ("student_id");