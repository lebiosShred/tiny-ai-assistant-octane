CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"gdrive_folder_id" text,
	"last_updated" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "document_companion_metadata" (
	"id" text PRIMARY KEY NOT NULL,
	"file_id" text NOT NULL,
	"file_name" text,
	"content_hash" text,
	"extracted_profile" text,
	"company" text,
	"prospect_name" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "file_id_idx" ON "document_companion_metadata" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "content_hash_idx" ON "document_companion_metadata" USING btree ("content_hash");