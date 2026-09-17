import {
  Task,
  Tag,
  Project,
  TaskStatus,
  RecurringRule,
} from "@/db/schema";

export interface TaskJoinRow {
  task: Task;
  tag: Tag | null;
  project: Project | null;
  status: TaskStatus | null;
  parent?: {
    id: string;
    title: string;
  } | null;
  recurringRule?: RecurringRule | null;
}
