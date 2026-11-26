CREATE TABLE "friend_blocks" (
	"blocker_id" uuid NOT NULL,
	"blocked_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "friend_blocks_blocker_id_blocked_id_pk" PRIMARY KEY("blocker_id","blocked_id")
);
--> statement-breakpoint
CREATE TABLE "friend_code_tries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"family_id" uuid NOT NULL,
	"ok" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "friend_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "friend_codes_code_hash_unique" UNIQUE("code_hash")
);
--> statement-breakpoint
CREATE TABLE "friend_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" uuid NOT NULL,
	"reported_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "friend_reports_reason" CHECK ("friend_reports"."reason" in ('upsetting_name', 'do_not_know', 'pressured', 'other'))
);
--> statement-breakpoint
CREATE TABLE "friend_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_student_id" uuid NOT NULL,
	"to_student_id" uuid NOT NULL,
	"status" text DEFAULT 'child_confirm' NOT NULL,
	"from_approved_by" integer,
	"to_approved_by" integer,
	"expires_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "friend_requests_status" CHECK ("friend_requests"."status" in ('child_confirm', 'parents', 'started', 'declined'))
);
--> statement-breakpoint
CREATE TABLE "friendships" (
	"student_a" uuid NOT NULL,
	"student_b" uuid NOT NULL,
	"label_a" text,
	"label_b" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "friendships_student_a_student_b_pk" PRIMARY KEY("student_a","student_b"),
	CONSTRAINT "friendships_order" CHECK ("friendships"."student_a" < "friendships"."student_b"),
	CONSTRAINT "friendships_label_a_length" CHECK (char_length("friendships"."label_a") between 1 and 30),
	CONSTRAINT "friendships_label_b_length" CHECK (char_length("friendships"."label_b") between 1 and 30)
);
--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "friends_allowed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "league_hidden" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "friend_blocks" ADD CONSTRAINT "friend_blocks_blocker_id_students_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_blocks" ADD CONSTRAINT "friend_blocks_blocked_id_students_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_code_tries" ADD CONSTRAINT "friend_code_tries_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_code_tries" ADD CONSTRAINT "friend_code_tries_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_codes" ADD CONSTRAINT "friend_codes_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_reports" ADD CONSTRAINT "friend_reports_reporter_id_students_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_reports" ADD CONSTRAINT "friend_reports_reported_id_students_id_fk" FOREIGN KEY ("reported_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_requests" ADD CONSTRAINT "friend_requests_from_student_id_students_id_fk" FOREIGN KEY ("from_student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_requests" ADD CONSTRAINT "friend_requests_to_student_id_students_id_fk" FOREIGN KEY ("to_student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_student_a_students_id_fk" FOREIGN KEY ("student_a") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_student_b_students_id_fk" FOREIGN KEY ("student_b") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "friend_blocks_blocked_idx" ON "friend_blocks" USING btree ("blocked_id");--> statement-breakpoint
CREATE INDEX "friend_code_tries_student_idx" ON "friend_code_tries" USING btree ("student_id","created_at");--> statement-breakpoint
CREATE INDEX "friend_code_tries_family_idx" ON "friend_code_tries" USING btree ("family_id","created_at");--> statement-breakpoint
CREATE INDEX "friend_codes_student_id_idx" ON "friend_codes" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "friend_reports_reporter_idx" ON "friend_reports" USING btree ("reporter_id");--> statement-breakpoint
CREATE INDEX "friend_reports_reported_idx" ON "friend_reports" USING btree ("reported_id");--> statement-breakpoint
CREATE INDEX "friend_requests_from_idx" ON "friend_requests" USING btree ("from_student_id");--> statement-breakpoint
CREATE INDEX "friend_requests_to_idx" ON "friend_requests" USING btree ("to_student_id");--> statement-breakpoint
CREATE INDEX "friendships_student_b_idx" ON "friendships" USING btree ("student_b");