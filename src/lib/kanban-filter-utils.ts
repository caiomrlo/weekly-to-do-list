import { TaskWithTag } from "@/db/schema";
import { toDateString, getMondayOfWeek } from "./date-utils";
import { addDaysToStr } from "./recurrence-utils";

export type KanbanDateFilter = "default" | "today" | "this_week" | "this_month" | "all";
export type KanbanProjectFilter = "all" | "none" | string;

export function getTaskTimestampDateStr(
  timestamp: Date | string | null | undefined
): string | null {
  if (!timestamp) return null;
  if (timestamp instanceof Date) {
    return toDateString(timestamp);
  }
  if (typeof timestamp === "string") {
    if (timestamp.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(timestamp)) {
      return timestamp;
    }
    const d = new Date(timestamp);
    if (!isNaN(d.getTime())) {
      return toDateString(d);
    }
    if (timestamp.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(timestamp)) {
      return timestamp.slice(0, 10);
    }
  }
  return null;
}

export function isTaskMatchingDateFilter(
  task: TaskWithTag,
  filter: KanbanDateFilter,
  refDate: Date = new Date()
): boolean {
  if (filter === "all") {
    return true;
  }

  const effectiveDate = task.date || task.originalDate || null;
  const todayStr = toDateString(refDate);

  if (filter === "today") {
    if (effectiveDate) {
      return effectiveDate === todayStr;
    }

    const updatedStr = getTaskTimestampDateStr(task.updatedAt);
    if (updatedStr && updatedStr === todayStr) {
      return true;
    }

    const createdStr = getTaskTimestampDateStr(task.createdAt);
    if (createdStr && createdStr === todayStr) {
      return true;
    }

    return false;
  }

  if (filter === "default") {
    const min30DaysStr = addDaysToStr(todayStr, -30);
    const max30DaysStr = addDaysToStr(todayStr, 30);

    if (effectiveDate && effectiveDate >= min30DaysStr && effectiveDate <= max30DaysStr) {
      return true;
    }

    const updatedStr = getTaskTimestampDateStr(task.updatedAt);
    if (updatedStr && updatedStr >= min30DaysStr && updatedStr <= max30DaysStr) {
      return true;
    }

    const createdStr = getTaskTimestampDateStr(task.createdAt);
    if (createdStr && createdStr >= min30DaysStr && createdStr <= max30DaysStr) {
      return true;
    }

    return false;
  }

  if (filter === "this_week") {
    const monday = getMondayOfWeek(refDate);
    const startOfWeekStr = toDateString(monday);
    const endOfWeekStr = addDaysToStr(startOfWeekStr, 6);

    if (effectiveDate) {
      return effectiveDate >= startOfWeekStr && effectiveDate <= endOfWeekStr;
    }

    const updatedStr = getTaskTimestampDateStr(task.updatedAt);
    if (updatedStr && updatedStr >= startOfWeekStr && updatedStr <= endOfWeekStr) {
      return true;
    }

    return false;
  }

  if (filter === "this_month") {
    const year = refDate.getFullYear();
    const month = refDate.getMonth();
    const startOfMonthStr = toDateString(new Date(year, month, 1));
    const endOfMonthStr = toDateString(new Date(year, month + 1, 0));

    if (effectiveDate) {
      return effectiveDate >= startOfMonthStr && effectiveDate <= endOfMonthStr;
    }

    const updatedStr = getTaskTimestampDateStr(task.updatedAt);
    if (updatedStr && updatedStr >= startOfMonthStr && updatedStr <= endOfMonthStr) {
      return true;
    }

    return false;
  }

  return true;
}

export function isTaskMatchingProjectFilter(
  task: TaskWithTag,
  selectedProjectId: KanbanProjectFilter
): boolean {
  if (selectedProjectId === "all") return true;
  if (selectedProjectId === "none") return !task.projectId;
  return task.projectId === selectedProjectId;
}

export function filterKanbanTasks(
  tasks: TaskWithTag[],
  options: {
    dateFilter: KanbanDateFilter;
    projectFilter: KanbanProjectFilter;
    refDate?: Date;
  }
): TaskWithTag[] {
  const { dateFilter, projectFilter, refDate = new Date() } = options;
  return tasks.filter((task) => {
    return (
      isTaskMatchingProjectFilter(task, projectFilter) &&
      isTaskMatchingDateFilter(task, dateFilter, refDate)
    );
  });
}
