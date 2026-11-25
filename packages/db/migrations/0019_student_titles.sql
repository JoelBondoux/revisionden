ALTER TABLE "students" ADD COLUMN "title_first" text;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "title_last" text;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_title_first_format" CHECK ("students"."title_first" ~ '^[A-Z][A-Za-z-]{0,15}$');--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_title_last_format" CHECK ("students"."title_last" ~ '^[A-Z][A-Za-z-]{0,15}$');