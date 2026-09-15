CREATE TABLE "task_statuses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" varchar(50) NOT NULL,
	"color" varchar(30) DEFAULT 'slate' NOT NULL,
	"category" varchar(20) NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "status_id" uuid;--> statement-breakpoint
ALTER TABLE "task_statuses" ADD CONSTRAINT "task_statuses_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "task_statuses_workspace_id_idx" ON "task_statuses" USING btree ("workspace_id");--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_status_id_task_statuses_id_fk" FOREIGN KEY ("status_id") REFERENCES "public"."task_statuses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tasks_status_id_idx" ON "tasks" USING btree ("status_id");