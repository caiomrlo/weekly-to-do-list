CREATE TABLE "docs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid,
	"title" varchar(255) DEFAULT 'Untitled Document' NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_docs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"doc_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "docs" ADD CONSTRAINT "docs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docs" ADD CONSTRAINT "docs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_docs" ADD CONSTRAINT "task_docs_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_docs" ADD CONSTRAINT "task_docs_doc_id_docs_id_fk" FOREIGN KEY ("doc_id") REFERENCES "public"."docs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_docs" ADD CONSTRAINT "task_docs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "docs_user_id_idx" ON "docs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "docs_project_id_idx" ON "docs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "docs_favorite_idx" ON "docs" USING btree ("user_id","is_favorite");--> statement-breakpoint
CREATE UNIQUE INDEX "task_docs_task_doc_unique_idx" ON "task_docs" USING btree ("task_id","doc_id");--> statement-breakpoint
CREATE INDEX "task_docs_task_id_idx" ON "task_docs" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "task_docs_doc_id_idx" ON "task_docs" USING btree ("doc_id");--> statement-breakpoint
CREATE INDEX "task_docs_user_id_idx" ON "task_docs" USING btree ("user_id");