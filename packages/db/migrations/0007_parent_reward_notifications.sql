CREATE TABLE "parent_push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "parent_push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
ALTER TABLE "parent_rewards" ADD COLUMN "reached_notified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "parent_push_subscriptions" ADD CONSTRAINT "parent_push_subscriptions_parent_id_parents_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."parents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "parent_push_subscriptions_parent_id_idx" ON "parent_push_subscriptions" USING btree ("parent_id");