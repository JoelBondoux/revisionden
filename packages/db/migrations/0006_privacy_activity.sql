ALTER TABLE "students" DROP CONSTRAINT "students_year_group_range";--> statement-breakpoint
ALTER TABLE "families" ADD COLUMN "last_active_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "families" ADD COLUMN "previous_active_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_year_group_range" CHECK ("students"."year_group" between 9 and 13);