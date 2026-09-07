import { pgTable, uuid, varchar, text, timestamp, boolean, date, integer, jsonb, index, AnyPgColumn } from "drizzle-orm/pg-core";

export interface UserPreferences {
  showSaturday?: boolean;
  showSunday?: boolean;
  theme?: "light" | "dark" | "system";
  [key: string]: unknown;
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  showSaturday: false,
  showSunday: false,
  theme: "light",
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
  color: varchar("color", { length: 30 }).default("indigo").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tagId: uuid("tag_id").references(() => tags.id, { onDelete: "set null" }),
  parentId: uuid("parent_id").references((): AnyPgColumn => tasks.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 500 }).notNull(),
  content: text("content").default("").notNull(),
  date: date("date"), // Formato 'YYYY-MM-DD' opcional (nulo para tarefas sem data fixa)
  time: varchar("time", { length: 5 }), // Formato opcional 'HH:mm'
  duration: integer("duration"), // Duração estimada em minutos (ex: 30, 60, 90)
  completed: boolean("completed").default(false).notNull(),
  order: integer("order").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const attachments = pgTable(
  "attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    filePath: text("file_path").notNull(), // Caminho relativo no R2 (ex: files/{attachmentId}/{fileName})
    thumbnailPath: text("thumbnail_path"), // Caminho relativo da thumbnail no R2 (ex: files/{attachmentId}/thumb.webp)
    contentType: varchar("content_type", { length: 100 }).notNull(),
    fileSize: integer("file_size").notNull(), // Tamanho em bytes
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("attachments_task_id_idx").on(table.taskId),
    index("attachments_user_id_idx").on(table.userId),
  ]
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;

export type Attachment = typeof attachments.$inferSelect;
export type NewAttachment = typeof attachments.$inferInsert;

export type TaskWithTag = Task & {
  tag?: Tag | null;
  parent?: { id: string; title: string } | null;
  subtaskCount?: number;
  completedSubtaskCount?: number;
  attachmentCount?: number;
};

