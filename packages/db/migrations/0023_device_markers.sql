CREATE TABLE "device_markers" (
	"marker_hash" text PRIMARY KEY NOT NULL,
	"device_id" uuid,
	"student_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "devices" DROP CONSTRAINT "devices_credential_id_unique";--> statement-breakpoint
ALTER TABLE "device_markers" ADD CONSTRAINT "device_markers_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_markers" ADD CONSTRAINT "device_markers_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "device_markers_device_id_idx" ON "device_markers" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "devices_credential_id_idx" ON "devices" USING btree ("credential_id");