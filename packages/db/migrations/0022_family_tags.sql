CREATE TABLE "family_tag_links" (
	"family_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"added_by" text NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "family_tag_links_pkey" PRIMARY KEY("family_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "family_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"colour" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"beta_programme" boolean DEFAULT false NOT NULL,
	"early_access" boolean DEFAULT false NOT NULL,
	"complimentary_premium" boolean DEFAULT false NOT NULL,
	"exclude_from_metrics" boolean DEFAULT false NOT NULL,
	"created_by" text NOT NULL,
	"retired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "family_tags_name_unique" UNIQUE("name"),
	CONSTRAINT "family_tags_name_length" CHECK (char_length("family_tags"."name") between 1 and 40),
	CONSTRAINT "family_tags_colour_format" CHECK ("family_tags"."colour" ~ '^#[0-9a-f]{6}$'),
	CONSTRAINT "family_tags_description_length" CHECK (char_length("family_tags"."description") <= 200)
);
--> statement-breakpoint
ALTER TABLE "family_tag_links" ADD CONSTRAINT "family_tag_links_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_tag_links" ADD CONSTRAINT "family_tag_links_tag_id_family_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."family_tags"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "family_tag_links_tag_idx" ON "family_tag_links" USING btree ("tag_id");