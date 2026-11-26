CREATE TABLE "league_weeks" (
	"student_id" uuid NOT NULL,
	"week_start" date NOT NULL,
	"xp" integer NOT NULL,
	"place" integer,
	"won" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "league_weeks_student_id_week_start_pk" PRIMARY KEY("student_id","week_start")
);
--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "league_wins" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "league_weeks" ADD CONSTRAINT "league_weeks_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;