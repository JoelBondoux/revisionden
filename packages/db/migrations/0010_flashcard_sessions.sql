CREATE TABLE "flashcard_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"card_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"completed" boolean DEFAULT false NOT NULL,
	"xp_earned" integer DEFAULT 0 NOT NULL,
	"topic_id" text,
	"rewarded_day" date,
	"reward_slot" integer,
	CONSTRAINT "flashcard_sessions_reward_slot" UNIQUE("student_id","rewarded_day","reward_slot"),
	CONSTRAINT "flashcard_sessions_reward_slot_range" CHECK ("flashcard_sessions"."reward_slot" between 1 and 2)
);
--> statement-breakpoint
ALTER TABLE "flashcard_sessions" ADD CONSTRAINT "flashcard_sessions_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "flashcard_sessions_student_started_idx" ON "flashcard_sessions" USING btree ("student_id","started_at");