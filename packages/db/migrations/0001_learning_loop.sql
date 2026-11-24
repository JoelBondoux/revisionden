CREATE TABLE "daily_xp" (
	"student_id" uuid NOT NULL,
	"day" date NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "daily_xp_student_id_day_pk" PRIMARY KEY("student_id","day")
);
--> statement-breakpoint
CREATE TABLE "flashcards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"item_id" uuid,
	"topic_id" text NOT NULL,
	"origin" text NOT NULL,
	"front" text,
	"back" text,
	"repetitions" integer DEFAULT 0 NOT NULL,
	"interval_days" integer DEFAULT 0 NOT NULL,
	"ease" real DEFAULT 2.5 NOT NULL,
	"due_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "flashcards_student_item_unique" UNIQUE("student_id","item_id"),
	CONSTRAINT "flashcards_origin_values" CHECK ("flashcards"."origin" in ('deck', 'wrong_answer', 'own'))
);
--> statement-breakpoint
CREATE TABLE "starting_tests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"subject_id" text NOT NULL,
	"item_ids" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "item_version" integer;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "mode" text;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "xp_earned" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "starting_test_id" uuid;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "content_id" text;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "status" text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "difficulty" integer;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "tags" jsonb;--> statement-breakpoint
ALTER TABLE "streaks" ADD COLUMN "skips_in_a_row" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "streaks" ADD COLUMN "last_date" date;--> statement-breakpoint
ALTER TABLE "streaks" ADD COLUMN "last_settled_week" date;--> statement-breakpoint
ALTER TABLE "daily_xp" ADD CONSTRAINT "daily_xp_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flashcards" ADD CONSTRAINT "flashcards_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flashcards" ADD CONSTRAINT "flashcards_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flashcards" ADD CONSTRAINT "flashcards_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "starting_tests" ADD CONSTRAINT "starting_tests_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "flashcards_student_due_idx" ON "flashcards" USING btree ("student_id","due_at");--> statement-breakpoint
CREATE INDEX "starting_tests_student_id_idx" ON "starting_tests" USING btree ("student_id");--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_starting_test_id_starting_tests_id_fk" FOREIGN KEY ("starting_test_id") REFERENCES "public"."starting_tests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_content_id_unique" UNIQUE("content_id");--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_status_values" CHECK ("items"."status" in ('draft', 'verified', 'quarantined', 'retired'));