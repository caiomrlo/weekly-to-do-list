import { pgTable, uuid, varchar, text, timestamp, boolean, date, integer, jsonb, index, uniqueIndex, AnyPgColumn } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export type BackgroundThemeId = "default" | "sunset" | "ocean" | "aurora" | "lavender" | "slate";

export interface UserPreferences {
  showSaturday?: boolean;
  showSunday?: boolean;
  theme?: "light" | "dark" | "system";
  background?: BackgroundThemeId;
  activeWorkspaceId?: string;
  [key: string]: unknown;
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  showSaturday: false,
  showSunday: false,
  theme: "light",
  background: "default",
};

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().default(""),
  email: varchar("email", { length: 255 }).notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  passwordHash: text("password_hash"),
  preferences: jsonb("preferences").$type<UserPreferences>().default(DEFAULT_USER_PREFERENCES).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
});

export const sessions = pgTable(
  "sessions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID())
      .default(sql`gen_random_uuid()::text`),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("sessions_user_id_idx").on(table.userId),
  ]
);

export const accounts = pgTable(
  "accounts",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID())
      .default(sql`gen_random_uuid()::text`),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("accounts_user_id_idx").on(table.userId),
  ]
);

export const verifications = pgTable(
  "verifications",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID())
      .default(sql`gen_random_uuid()::text`),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("verifications_identifier_idx").on(table.identifier),
  ]
);

export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 100 }).notNull(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    isDefault: boolean("is_default").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("workspaces_owner_id_idx").on(table.ownerId),
  ]
);

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 20 }).default("owner").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("workspace_members_ws_user_unique_idx").on(table.workspaceId, table.userId),
    index("workspace_members_workspace_id_idx").on(table.workspaceId),
    index("workspace_members_user_id_idx").on(table.userId),
  ]
);

export const workspaceInvites = pgTable(
  "workspace_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    invitedBy: uuid("invited_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: varchar("token", { length: 64 }).notNull(),
    email: varchar("email", { length: 255 }),
    role: varchar("role", { length: 20 }).default("member").notNull(),
    status: varchar("status", { length: 20 }).default("active").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("workspace_invites_token_unique_idx").on(table.token),
    index("workspace_invites_workspace_id_idx").on(table.workspaceId),
    index("workspace_invites_email_idx").on(table.email),
  ]
);

export const tags = pgTable(
  "tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 50 }).notNull(),
    color: varchar("color", { length: 30 }).default("amber").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("tags_workspace_id_idx").on(table.workspaceId),
    index("tags_user_id_idx").on(table.userId),
  ]
);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 50 }).notNull(),
    color: varchar("color", { length: 30 }).default("amber").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("projects_workspace_id_idx").on(table.workspaceId),
    index("projects_user_id_idx").on(table.userId),
  ]
);

export type RecurrenceFrequency = "daily" | "weekly" | "monthly" | "yearly";

export const recurringRules = pgTable(
  "recurring_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    frequency: varchar("frequency", { length: 20 }).$type<RecurrenceFrequency>().notNull(),
    interval: integer("interval").default(1).notNull(),
    daysOfWeek: jsonb("days_of_week").$type<number[]>(),
    dayOfMonth: integer("day_of_month"),
    monthOfYear: integer("month_of_year"),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
    exceptions: jsonb("exceptions").$type<string[]>().default([]).notNull(),

    // Master template attributes
    title: varchar("title", { length: 500 }).notNull(),
    content: text("content").default("").notNull(),
    time: varchar("time", { length: 5 }),
    duration: integer("duration"),
    tagId: uuid("tag_id").references(() => tags.id, { onDelete: "set null" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("recurring_rules_workspace_id_idx").on(table.workspaceId),
    index("recurring_rules_user_id_idx").on(table.userId),
    index("recurring_rules_start_date_idx").on(table.startDate),
  ]
);

export type TaskStatusCategory = "todo" | "doing" | "done";

export const taskStatuses = pgTable(
  "task_statuses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 50 }).notNull(),
    color: varchar("color", { length: 30 }).default("slate").notNull(),
    category: varchar("category", { length: 20 }).$type<TaskStatusCategory>().notNull(),
    order: integer("order").default(0).notNull(),
    isDefault: boolean("is_default").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("task_statuses_workspace_id_idx").on(table.workspaceId),
  ]
);

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id").references(() => tags.id, { onDelete: "set null" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    statusId: uuid("status_id").references(() => taskStatuses.id, { onDelete: "set null" }),
    parentId: uuid("parent_id").references((): AnyPgColumn => tasks.id, { onDelete: "cascade" }),
    recurringRuleId: uuid("recurring_rule_id").references(() => recurringRules.id, { onDelete: "set null" }),
    title: varchar("title", { length: 500 }).notNull(),
    content: text("content").default("").notNull(),
    date: date("date"), // 'YYYY-MM-DD' 
    originalDate: date("original_date"), // 'YYYY-MM-DD'
    time: varchar("time", { length: 5 }), // 'HH:mm'
    duration: integer("duration"), // (ex: 30, 60, 90)
    completed: boolean("completed").default(false).notNull(),
    order: integer("order").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("tasks_workspace_id_idx").on(table.workspaceId),
    index("tasks_user_id_idx").on(table.userId),
    index("tasks_status_id_idx").on(table.statusId),
    index("tasks_date_idx").on(table.date),
    index("tasks_parent_id_idx").on(table.parentId),
    index("tasks_recurring_rule_id_idx").on(table.recurringRuleId),
  ]
);

export const attachments = pgTable(
  "attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id").references(() => tasks.id, { onDelete: "set null" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    filePath: text("file_path").notNull(), // (ex: files/{attachmentId}/{fileName})
    thumbnailPath: text("thumbnail_path"), // (ex: files/{attachmentId}/thumb.webp)
    contentType: varchar("content_type", { length: 100 }).notNull(),
    fileSize: integer("file_size").notNull(), // bytes
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("attachments_task_id_idx").on(table.taskId),
    index("attachments_user_id_idx").on(table.userId),
  ]
);

export const docs = pgTable(
  "docs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    title: varchar("title", { length: 255 }).default("Untitled Document").notNull(),
    content: text("content").default("").notNull(),
    isFavorite: boolean("is_favorite").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("docs_workspace_id_idx").on(table.workspaceId),
    index("docs_user_id_idx").on(table.userId),
    index("docs_project_id_idx").on(table.projectId),
    index("docs_favorite_idx").on(table.userId, table.isFavorite),
  ]
);

export const taskDocs = pgTable(
  "task_docs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    docId: uuid("doc_id")
      .notNull()
      .references(() => docs.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("task_docs_task_doc_unique_idx").on(table.taskId, table.docId),
    index("task_docs_task_id_idx").on(table.taskId),
    index("task_docs_doc_id_idx").on(table.docId),
    index("task_docs_user_id_idx").on(table.userId),
  ]
);

export const taskAttachments = pgTable(
  "task_attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    attachmentId: uuid("attachment_id")
      .notNull()
      .references(() => attachments.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("task_attachments_task_attachment_unique_idx").on(
      table.taskId,
      table.attachmentId
    ),
    index("task_attachments_task_id_idx").on(table.taskId),
    index("task_attachments_attachment_id_idx").on(table.attachmentId),
    index("task_attachments_user_id_idx").on(table.userId),
  ]
);

export const docAttachments = pgTable(
  "doc_attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    docId: uuid("doc_id")
      .notNull()
      .references(() => docs.id, { onDelete: "cascade" }),
    attachmentId: uuid("attachment_id")
      .notNull()
      .references(() => attachments.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("doc_attachments_doc_attachment_unique_idx").on(
      table.docId,
      table.attachmentId
    ),
    index("doc_attachments_doc_id_idx").on(table.docId),
    index("doc_attachments_attachment_id_idx").on(table.attachmentId),
    index("doc_attachments_user_id_idx").on(table.userId),
  ]
);

export const taskAssignees = pgTable(
  "task_assignees",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("task_assignees_task_user_unique_idx").on(table.taskId, table.userId),
    index("task_assignees_task_id_idx").on(table.taskId),
    index("task_assignees_user_id_idx").on(table.userId),
  ]
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;

export type Verification = typeof verifications.$inferSelect;
export type NewVerification = typeof verifications.$inferInsert;

export type Workspace = typeof workspaces.$inferSelect;
export type NewWorkspace = typeof workspaces.$inferInsert;

export type WorkspaceMember = typeof workspaceMembers.$inferSelect;
export type NewWorkspaceMember = typeof workspaceMembers.$inferInsert;

export type WorkspaceInvite = typeof workspaceInvites.$inferSelect;
export type NewWorkspaceInvite = typeof workspaceInvites.$inferInsert;

export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;

export type TaskStatus = typeof taskStatuses.$inferSelect;
export type NewTaskStatus = typeof taskStatuses.$inferInsert;

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;

export type Attachment = typeof attachments.$inferSelect;
export type NewAttachment = typeof attachments.$inferInsert;

export type Doc = typeof docs.$inferSelect;
export type NewDoc = typeof docs.$inferInsert;

export type TaskDoc = typeof taskDocs.$inferSelect;
export type NewTaskDoc = typeof taskDocs.$inferInsert;

export type TaskAttachment = typeof taskAttachments.$inferSelect;
export type NewTaskAttachment = typeof taskAttachments.$inferInsert;

export type DocAttachment = typeof docAttachments.$inferSelect;
export type NewDocAttachment = typeof docAttachments.$inferInsert;

export type TaskAssignee = typeof taskAssignees.$inferSelect;
export type NewTaskAssignee = typeof taskAssignees.$inferInsert;

export interface TaskAssigneeUser {
  id: string; // userId
  name: string;
  email: string;
  image?: string | null;
}

export type RecurringRule = typeof recurringRules.$inferSelect;
export type NewRecurringRule = typeof recurringRules.$inferInsert;

export type TaskWithTag = Task & {
  tag?: Tag | null;
  project?: Project | null;
  parent?: { id: string; title: string } | null;
  recurringRule?: RecurringRule | null;
  status?: TaskStatus | null;
  subtaskCount?: number;
  completedSubtaskCount?: number;
  attachmentCount?: number;
  docCount?: number;
  assignees?: TaskAssigneeUser[];
};

export type TaskWithProject = TaskWithTag;
export type TaskWithRelations = TaskWithTag;

export type DocWithRelations = Doc & {
  project?: Project | null;
  taskCount?: number;
  tasks?: Array<{
    id: string;
    title: string;
    completed: boolean;
    date?: string | null;
  }>;
  attachmentCount?: number;
  attachments?: Array<Attachment & { url: string; thumbUrl?: string | null }>;
};


