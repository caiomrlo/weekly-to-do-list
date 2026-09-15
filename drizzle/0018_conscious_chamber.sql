CREATE TABLE IF NOT EXISTS "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"owner_id" uuid NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "workspace_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(20) DEFAULT 'owner' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workspaces" DROP CONSTRAINT IF EXISTS "workspaces_owner_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "workspace_members" DROP CONSTRAINT IF EXISTS "workspace_members_workspace_id_workspaces_id_fk";
--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "workspace_members" DROP CONSTRAINT IF EXISTS "workspace_members_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "workspace_members_ws_user_unique_idx" ON "workspace_members" USING btree ("workspace_id","user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workspace_members_workspace_id_idx" ON "workspace_members" USING btree ("workspace_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workspace_members_user_id_idx" ON "workspace_members" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workspaces_owner_id_idx" ON "workspaces" USING btree ("owner_id");
--> statement-breakpoint

-- Backfill default workspaces for existing users
INSERT INTO "workspaces" ("id", "name", "owner_id", "is_default", "created_at", "updated_at")
SELECT gen_random_uuid(), 'My Workspace', "id", true, now(), now()
FROM "users"
WHERE NOT EXISTS (
  SELECT 1 FROM "workspaces" WHERE "workspaces"."owner_id" = "users"."id"
);
--> statement-breakpoint

-- Backfill workspace membership for existing users
INSERT INTO "workspace_members" ("id", "workspace_id", "user_id", "role", "joined_at")
SELECT gen_random_uuid(), "w"."id", "w"."owner_id", 'owner', now()
FROM "workspaces" "w"
WHERE NOT EXISTS (
  SELECT 1 FROM "workspace_members" "wm" WHERE "wm"."workspace_id" = "w"."id" AND "wm"."user_id" = "w"."owner_id"
);
--> statement-breakpoint

-- Backfill active workspace preference
UPDATE "users"
SET "preferences" = jsonb_set(COALESCE("preferences", '{}'::jsonb), '{activeWorkspaceId}', to_jsonb("w"."id"::text))
FROM "workspaces" "w"
WHERE "w"."owner_id" = "users"."id" AND "w"."is_default" = true
  AND ("users"."preferences"->>'activeWorkspaceId' IS NULL);
--> statement-breakpoint

-- Add nullable columns first
ALTER TABLE "docs" ADD COLUMN IF NOT EXISTS "workspace_id" uuid;
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "workspace_id" uuid;
--> statement-breakpoint
ALTER TABLE "recurring_rules" ADD COLUMN IF NOT EXISTS "workspace_id" uuid;
--> statement-breakpoint
ALTER TABLE "tags" ADD COLUMN IF NOT EXISTS "workspace_id" uuid;
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "workspace_id" uuid;
--> statement-breakpoint

-- Backfill existing rows with user's default workspace
UPDATE "docs" SET "workspace_id" = (SELECT "id" FROM "workspaces" WHERE "owner_id" = "docs"."user_id" AND "is_default" = true LIMIT 1) WHERE "workspace_id" IS NULL;
--> statement-breakpoint
UPDATE "projects" SET "workspace_id" = (SELECT "id" FROM "workspaces" WHERE "owner_id" = "projects"."user_id" AND "is_default" = true LIMIT 1) WHERE "workspace_id" IS NULL;
--> statement-breakpoint
UPDATE "recurring_rules" SET "workspace_id" = (SELECT "id" FROM "workspaces" WHERE "owner_id" = "recurring_rules"."user_id" AND "is_default" = true LIMIT 1) WHERE "workspace_id" IS NULL;
--> statement-breakpoint
UPDATE "tags" SET "workspace_id" = (SELECT "id" FROM "workspaces" WHERE "owner_id" = "tags"."user_id" AND "is_default" = true LIMIT 1) WHERE "workspace_id" IS NULL;
--> statement-breakpoint
UPDATE "tasks" SET "workspace_id" = (SELECT "id" FROM "workspaces" WHERE "owner_id" = "tasks"."user_id" AND "is_default" = true LIMIT 1) WHERE "workspace_id" IS NULL;
--> statement-breakpoint

-- Enforce NOT NULL constraints
ALTER TABLE "docs" ALTER COLUMN "workspace_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "workspace_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "recurring_rules" ALTER COLUMN "workspace_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "tags" ALTER COLUMN "workspace_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "workspace_id" SET NOT NULL;
--> statement-breakpoint

-- Add foreign key constraints
ALTER TABLE "docs" DROP CONSTRAINT IF EXISTS "docs_workspace_id_workspaces_id_fk";
--> statement-breakpoint
ALTER TABLE "docs" ADD CONSTRAINT "docs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "projects" DROP CONSTRAINT IF EXISTS "projects_workspace_id_workspaces_id_fk";
--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recurring_rules" DROP CONSTRAINT IF EXISTS "recurring_rules_workspace_id_workspaces_id_fk";
--> statement-breakpoint
ALTER TABLE "recurring_rules" ADD CONSTRAINT "recurring_rules_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tags" DROP CONSTRAINT IF EXISTS "tags_workspace_id_workspaces_id_fk";
--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "tasks_workspace_id_workspaces_id_fk";
--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

-- Create indexes
CREATE INDEX IF NOT EXISTS "docs_workspace_id_idx" ON "docs" USING btree ("workspace_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_workspace_id_idx" ON "projects" USING btree ("workspace_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_user_id_idx" ON "projects" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recurring_rules_workspace_id_idx" ON "recurring_rules" USING btree ("workspace_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tags_workspace_id_idx" ON "tags" USING btree ("workspace_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tags_user_id_idx" ON "tags" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_workspace_id_idx" ON "tasks" USING btree ("workspace_id");