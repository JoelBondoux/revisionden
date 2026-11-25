CREATE TABLE "daily_limits" (
	"student_id" uuid PRIMARY KEY NOT NULL,
	"weekday_minutes" integer,
	"other_day_minutes" integer,
	"exam_season_extra" boolean DEFAULT false NOT NULL,
	"changed_at" timestamp with time zone,
	"student_seen_at" timestamp with time zone,
	"last_suggested_on" date,
	"last_raise_on" date,
	"pending_suggestion" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_limits_weekday_range" CHECK ("daily_limits"."weekday_minutes" is null or "daily_limits"."weekday_minutes" between 15 and 360),
	CONSTRAINT "daily_limits_other_range" CHECK ("daily_limits"."other_day_minutes" is null or "daily_limits"."other_day_minutes" between 15 and 360)
);
--> statement-breakpoint
ALTER TABLE "daily_limits" ADD CONSTRAINT "daily_limits_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;