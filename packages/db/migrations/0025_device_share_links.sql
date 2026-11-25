ALTER TABLE "device_link_tokens" ADD COLUMN "kind" text DEFAULT 'qr' NOT NULL;--> statement-breakpoint
ALTER TABLE "device_link_tokens" ADD COLUMN "code_hash" text;--> statement-breakpoint
ALTER TABLE "device_link_tokens" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "device_type" text;--> statement-breakpoint
ALTER TABLE "device_link_tokens" ADD CONSTRAINT "device_link_tokens_code_hash_unique" UNIQUE("code_hash");--> statement-breakpoint
ALTER TABLE "device_link_tokens" ADD CONSTRAINT "device_link_tokens_kind_values" CHECK ("device_link_tokens"."kind" in ('qr', 'share'));--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_device_type_values" CHECK ("devices"."device_type" in ('phone', 'tablet', 'computer'));