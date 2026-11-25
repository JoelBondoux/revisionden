CREATE TABLE "feedback_replies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"feedback_id" uuid NOT NULL,
	"author_email" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feedback_replies_body_length" CHECK (char_length("feedback_replies"."body") between 1 and 5000)
);
--> statement-breakpoint
CREATE TABLE "operator_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"author_email" text NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "operator_notes_text_length" CHECK (char_length("operator_notes"."text") between 1 and 2000)
);
--> statement-breakpoint
ALTER TABLE "feedback_replies" ADD CONSTRAINT "feedback_replies_feedback_id_feedback_id_fk" FOREIGN KEY ("feedback_id") REFERENCES "public"."feedback"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operator_notes" ADD CONSTRAINT "operator_notes_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feedback_replies_feedback_id_idx" ON "feedback_replies" USING btree ("feedback_id","created_at");--> statement-breakpoint
CREATE INDEX "operator_notes_family_id_idx" ON "operator_notes" USING btree ("family_id","created_at");