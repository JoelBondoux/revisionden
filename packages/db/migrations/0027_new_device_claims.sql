CREATE TABLE "passkey_new_device_claims" (
	"credential_id" text PRIMARY KEY NOT NULL,
	"student_id" uuid NOT NULL,
	"claimed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "passkey_new_device_claims" ADD CONSTRAINT "passkey_new_device_claims_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;