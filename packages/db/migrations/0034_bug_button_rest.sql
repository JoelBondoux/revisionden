ALTER TABLE "feedback" DROP CONSTRAINT "feedback_outcome_values";--> statement-breakpoint
ALTER TABLE "feedback" ADD COLUMN "not_a_bug_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "bug_button_reset_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "bug_button_removed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "tester" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "feedback_student_not_a_bug_idx" ON "feedback" USING btree ("student_id","not_a_bug_at");--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_outcome_values" CHECK ("feedback"."outcome" in ('confirmed', 'duplicate', 'not_a_bug'));