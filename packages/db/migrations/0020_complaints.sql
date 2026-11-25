CREATE TABLE "complaint_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"complaint_id" uuid NOT NULL,
	"sender" text NOT NULL,
	"author_email" text,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "complaint_messages_sender_values" CHECK ("complaint_messages"."sender" in ('family', 'operator')),
	CONSTRAINT "complaint_messages_body_length" CHECK (char_length("complaint_messages"."body") between 1 and 5000)
);
--> statement-breakpoint
CREATE TABLE "complaint_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"topic" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "complaint_requests_topic_values" CHECK ("complaint_requests"."topic" in ('marking', 'unfair', 'app_problem', 'my_data', 'something_else')),
	CONSTRAINT "complaint_requests_note_length" CHECK (char_length("complaint_requests"."note") <= 300)
);
--> statement-breakpoint
CREATE TABLE "complaints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid,
	"channel" text NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"summary" text NOT NULL,
	"about_personal_data" boolean NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"acknowledge_due_at" timestamp with time zone NOT NULL,
	"resolve_due_at" timestamp with time zone NOT NULL,
	"acknowledged_at" timestamp with time zone,
	"escalated_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"outcome" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "complaints_channel_values" CHECK ("complaints"."channel" in ('app', 'email')),
	CONSTRAINT "complaints_status_values" CHECK ("complaints"."status" in ('new', 'acknowledged', 'resolved', 'escalated')),
	CONSTRAINT "complaints_summary_length" CHECK (char_length("complaints"."summary") between 1 and 500),
	CONSTRAINT "complaints_outcome_length" CHECK (char_length("complaints"."outcome") <= 2000)
);
--> statement-breakpoint
ALTER TABLE "complaint_messages" ADD CONSTRAINT "complaint_messages_complaint_id_complaints_id_fk" FOREIGN KEY ("complaint_id") REFERENCES "public"."complaints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaint_requests" ADD CONSTRAINT "complaint_requests_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaint_requests" ADD CONSTRAINT "complaint_requests_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "complaint_messages_complaint_idx" ON "complaint_messages" USING btree ("complaint_id","created_at");--> statement-breakpoint
CREATE INDEX "complaint_requests_family_idx" ON "complaint_requests" USING btree ("family_id","created_at");--> statement-breakpoint
CREATE INDEX "complaints_family_id_idx" ON "complaints" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "complaints_status_idx" ON "complaints" USING btree ("status","acknowledge_due_at");