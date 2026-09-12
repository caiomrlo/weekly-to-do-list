import { pgTable, uuid, varchar, text, timestamp, boolean, date, integer, jsonb, index, uniqueIndex, AnyPgColumn } from "drizzle-orm/pg-core";

export type BackgroundThemeId = "default" | "sunset" | "ocean" | "aurora" | "lavender" | "slate";

export interface UserPreferences {
  showSaturday?: boolean;
  showSunday?: boolean;
  theme?: "light" | "dark" | "system";
  background?: BackgroundThemeId;
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
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  preferences: jsonb("preferences").$type<UserPreferences>().default(DEFAULT_USER_PREFERENCES).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
});

export const tags = pgTable("tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 50 }).notNull(),
  color: varchar("color", { length: 30 }).default("amber").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 50 }).notNull(),
  color: varchar("color", { length: 30 }).default("amber").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tagId: uuid("tag_id").references(() => tags.id, { onDelete: "set null" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  parentId: uuid("parent_id").references((): AnyPgColumn => tasks.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 500 }).notNull(),
  content: text("content").default("").notNull(),
  date: date("date"), // 'YYYY-MM-DD' 
  time: varchar("time", { length: 5 }), // 'HH:mm'
  duration: integer("duration"), // (ex: 30, 60, 90)
  completed: boolean("completed").default(false).notNull(),
  order: integer("order").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

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

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;

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

export type TaskWithTag = Task & {
  tag?: Tag | null;
  project?: Project | null;
  parent?: { id: string; title: string } | null;
  subtaskCount?: number;
  completedSubtaskCount?: number;
  attachmentCount?: number;
  docCount?: number;
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


