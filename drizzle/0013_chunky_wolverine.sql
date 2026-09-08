CREATE TABLE "task_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"attachment_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "task_attachments" ADD CONSTRAINT "task_attachments_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_attachments" ADD CONSTRAINT "task_attachments_attachment_id_attachments_id_fk" FOREIGN KEY ("attachment_id") REFERENCES "public"."attachments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_attachments" ADD CONSTRAINT "task_attachments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "task_attachments_task_attachment_unique_idx" ON "task_attachments" USING btree ("task_id","attachment_id");--> statement-breakpoint
CREATE INDEX "task_attachments_task_id_idx" ON "task_attachments" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "task_attachments_attachment_id_idx" ON "task_attachments" USING btree ("attachment_id");--> statement-breakpoint
CREATE INDEX "task_attachments_user_id_idx" ON "task_attachments" USING btree ("user_id");--> statement-breakpoint
INSERT INTO "task_attachments" ("id", "task_id", "attachment_id", "user_id", "created_at")
SELECT gen_random_uuid(), "task_id", "id", "user_id", "created_at"
FROM "attachments"
WHERE "task_id" IS NOT NULL
ON CONFLICT DO NOTHING;