CREATE TABLE "doc_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"doc_id" uuid NOT NULL,
	"attachment_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attachments" DROP CONSTRAINT "attachments_task_id_tasks_id_fk";
--> statement-breakpoint
ALTER TABLE "attachments" ALTER COLUMN "task_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "doc_attachments" ADD CONSTRAINT "doc_attachments_doc_id_docs_id_fk" FOREIGN KEY ("doc_id") REFERENCES "public"."docs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doc_attachments" ADD CONSTRAINT "doc_attachments_attachment_id_attachments_id_fk" FOREIGN KEY ("attachment_id") REFERENCES "public"."attachments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doc_attachments" ADD CONSTRAINT "doc_attachments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "doc_attachments_doc_attachment_unique_idx" ON "doc_attachments" USING btree ("doc_id","attachment_id");--> statement-breakpoint
CREATE INDEX "doc_attachments_doc_id_idx" ON "doc_attachments" USING btree ("doc_id");--> statement-breakpoint
CREATE INDEX "doc_attachments_attachment_id_idx" ON "doc_attachments" USING btree ("attachment_id");--> statement-breakpoint
CREATE INDEX "doc_attachments_user_id_idx" ON "doc_attachments" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;