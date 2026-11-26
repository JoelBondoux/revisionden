ALTER TABLE "feedback" DROP CONSTRAINT "feedback_kind_values";--> statement-breakpoint
ALTER TABLE "feedback" ADD COLUMN "item_id" uuid;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_lesson_tap" CHECK (case when "feedback"."kind" in ('lesson_helped', 'lesson_not_helped') then "feedback"."item_id" is not null and "feedback"."text" is null else "feedback"."item_id" is null end);--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_kind_values" CHECK ("feedback"."kind" in ('bug', 'idea', 'confusing', 'other', 'lesson_helped', 'lesson_not_helped'));