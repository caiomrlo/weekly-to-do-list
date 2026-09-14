CREATE TABLE "recurring_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"frequency" varchar(20) NOT NULL,
	"interval" integer DEFAULT 1 NOT NULL,
	"days_of_week" jsonb,
	"day_of_month" integer,
	"month_of_year" integer,
	"start_date" date NOT NULL,
	"end_date" date,
	"exceptions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"title" varchar(500) NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"time" varchar(5),
	"duration" integer,
	"tag_id" uuid,
	"project_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "recurring_rule_id" uuid;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "original_date" date;--> statement-breakpoint
ALTER TABLE "recurring_rules" ADD CONSTRAINT "recurring_rules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_rules" ADD CONSTRAINT "recurring_rules_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_rules" ADD CONSTRAINT "recurring_rules_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recurring_rules_user_id_idx" ON "recurring_rules" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "recurring_rules_start_date_idx" ON "recurring_rules" USING btree ("start_date");--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_recurring_rule_id_recurring_rules_id_fk" FOREIGN KEY ("recurring_rule_id") REFERENCES "public"."recurring_rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tasks_user_id_idx" ON "tasks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tasks_date_idx" ON "tasks" USING btree ("date");--> statement-breakpoint
CREATE INDEX "tasks_parent_id_idx" ON "tasks" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "tasks_recurring_rule_id_idx" ON "tasks" USING btree ("recurring_rule_id");