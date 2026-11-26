CREATE TABLE "review_points" (
	"student_id" uuid NOT NULL,
	"learning_point" text NOT NULL,
	"topic_id" text NOT NULL,
	"rung" integer DEFAULT 0 NOT NULL,
	"due_day" date NOT NULL,
	"misses" integer DEFAULT 0 NOT NULL,
	"flagged" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_points_student_id_learning_point_pk" PRIMARY KEY("student_id","learning_point")
);
--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "retry" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "learning_point" text;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "expected_seconds" integer;--> statement-breakpoint
ALTER TABLE "review_points" ADD CONSTRAINT "review_points_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "review_points_student_due_idx" ON "review_points" USING btree ("student_id","due_day");