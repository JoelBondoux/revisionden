-- One "Did this help?" tap per student and item (W8b). Keep the newest of any duplicates first.
DELETE FROM "feedback" f USING "feedback" g
WHERE f."kind" IN ('lesson_helped', 'lesson_not_helped')
  AND g."kind" IN ('lesson_helped', 'lesson_not_helped')
  AND f."student_id" = g."student_id" AND f."item_id" = g."item_id"
  AND (f."created_at", f."id") < (g."created_at", g."id");--> statement-breakpoint
CREATE UNIQUE INDEX "feedback_lesson_tap_unique" ON "feedback" USING btree ("student_id","item_id") WHERE "feedback"."kind" in ('lesson_helped', 'lesson_not_helped');