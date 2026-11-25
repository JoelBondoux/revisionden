ALTER TABLE "feedback" ADD COLUMN "outcome" text;--> statement-breakpoint
ALTER TABLE "feedback" ADD COLUMN "duplicate_of" uuid;--> statement-breakpoint
ALTER TABLE "feedback" ADD COLUMN "reward_xp" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "feedback" ADD COLUMN "track_step" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "feedback" ADD COLUMN "confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "feedback" ADD COLUMN "reward_seen_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_duplicate_of_feedback_id_fk" FOREIGN KEY ("duplicate_of") REFERENCES "public"."feedback"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feedback_student_confirmed_idx" ON "feedback" USING btree ("student_id","confirmed_at");--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_outcome_values" CHECK ("feedback"."outcome" in ('confirmed', 'duplicate'));