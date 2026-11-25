CREATE TABLE "discount_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"kind" text NOT NULL,
	"amount" integer NOT NULL,
	"months" integer,
	"expires_on" date,
	"max_uses" integer,
	"created_by" text NOT NULL,
	"disabled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "discount_codes_code_unique" UNIQUE("code"),
	CONSTRAINT "discount_codes_code_format" CHECK ("discount_codes"."code" ~ '^[A-Z0-9]{6,16}$'),
	CONSTRAINT "discount_codes_kind_values" CHECK ("discount_codes"."kind" in ('percent', 'fixed')),
	CONSTRAINT "discount_codes_amount_range" CHECK ("discount_codes"."amount" >= 1 and ("discount_codes"."kind" <> 'percent' or "discount_codes"."amount" <= 100)),
	CONSTRAINT "discount_codes_months_positive" CHECK ("discount_codes"."months" is null or "discount_codes"."months" >= 1),
	CONSTRAINT "discount_codes_max_uses_positive" CHECK ("discount_codes"."max_uses" is null or "discount_codes"."max_uses" >= 1)
);
--> statement-breakpoint
CREATE TABLE "discount_redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code_id" uuid NOT NULL,
	"family_id" uuid NOT NULL,
	"redeemed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "discount_redemptions" ADD CONSTRAINT "discount_redemptions_code_id_discount_codes_id_fk" FOREIGN KEY ("code_id") REFERENCES "public"."discount_codes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_redemptions" ADD CONSTRAINT "discount_redemptions_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "discount_redemptions_code_idx" ON "discount_redemptions" USING btree ("code_id");--> statement-breakpoint
CREATE UNIQUE INDEX "discount_redemptions_one_active_per_family" ON "discount_redemptions" USING btree ("family_id") WHERE "discount_redemptions"."ended_at" is null;