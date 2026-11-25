ALTER TABLE "device_link_tokens" ADD COLUMN "kind" text DEFAULT 'qr' NOT NULL;--> statement-breakpoint
ALTER TABLE "device_link_tokens" ADD COLUMN "code_hash" text;--> statement-breakpoint
ALTER TABLE "device_link_tokens" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "device_link_tokens" ADD COLUMN "linked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "device_type" text;--> statement-breakpoint
ALTER TABLE "passkey_challenges" ADD COLUMN "link_token_id" uuid;--> statement-breakpoint
ALTER TABLE "passkey_challenges" ADD CONSTRAINT "passkey_challenges_link_token_id_device_link_tokens_id_fk" FOREIGN KEY ("link_token_id") REFERENCES "public"."device_link_tokens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_link_tokens" ADD CONSTRAINT "device_link_tokens_code_hash_unique" UNIQUE("code_hash");--> statement-breakpoint
ALTER TABLE "device_link_tokens" ADD CONSTRAINT "device_link_tokens_kind_values" CHECK ("device_link_tokens"."kind" in ('qr', 'share'));--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_device_type_values" CHECK ("devices"."device_type" in ('phone', 'tablet', 'computer'));