CREATE TABLE "ai_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"job" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer NOT NULL,
	"output_tokens" integer NOT NULL,
	"cost_micro_usd" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "reminder_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"local_date" date NOT NULL,
	"message" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reminder_log_student_kind_day_unique" UNIQUE("student_id","kind","local_date")
);
--> statement-breakpoint
CREATE TABLE "reminder_settings" (
	"student_id" uuid PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"streak_reminders" boolean DEFAULT true NOT NULL,
	"session_reminders" boolean DEFAULT true NOT NULL,
	"quiet_start" text DEFAULT '21:00' NOT NULL,
	"quiet_end" text DEFAULT '07:30' NOT NULL,
	"weekday_quiet_start" text DEFAULT '08:30' NOT NULL,
	"weekday_quiet_end" text DEFAULT '15:30' NOT NULL,
	"session_reminder_time" text DEFAULT '16:30' NOT NULL,
	"streak_reminder_time" text DEFAULT '19:00' NOT NULL,
	"time_zone" text DEFAULT 'Europe/London' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reminder_settings_quiet_start_format" CHECK ("reminder_settings"."quiet_start" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
	CONSTRAINT "reminder_settings_quiet_end_format" CHECK ("reminder_settings"."quiet_end" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
	CONSTRAINT "reminder_settings_weekday_quiet_start_format" CHECK ("reminder_settings"."weekday_quiet_start" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
	CONSTRAINT "reminder_settings_weekday_quiet_end_format" CHECK ("reminder_settings"."weekday_quiet_end" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
	CONSTRAINT "reminder_settings_session_time_format" CHECK ("reminder_settings"."session_reminder_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
	CONSTRAINT "reminder_settings_streak_time_format" CHECK ("reminder_settings"."streak_reminder_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
);
--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_log" ADD CONSTRAINT "reminder_log_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_settings" ADD CONSTRAINT "reminder_settings_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_usage_student_created_idx" ON "ai_usage" USING btree ("student_id","created_at");--> statement-breakpoint
CREATE INDEX "push_subscriptions_student_id_idx" ON "push_subscriptions" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "reminder_log_student_day_idx" ON "reminder_log" USING btree ("student_id","local_date");