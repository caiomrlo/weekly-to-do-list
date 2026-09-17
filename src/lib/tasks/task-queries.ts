import { db } from "@/db";
import {
  tasks,
  tags,
  projects,
  taskStatuses,
  taskDocs,
  taskAttachments,
  recurringRules,
  workspaceMembers,
  TaskWithTag,
} from "@/db/schema";
import { and, eq, gte, lte, asc, isNotNull, sql, or, isNull, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { TaskJoinRow } from "./task-types";
import { batchFetchTaskAssignees } from "./task-assignees";
import { projectRecurringTasksForWindow } from "./task-recurrence";

export async function hydrateTaskRows(
  rows: TaskJoinRow[]
): Promise<TaskWithTag[]> {
  if (rows.length === 0) return [];

  const taskIds = rows.map((r) => r.task.id);

  const [subtaskStats, attachmentStats, docStats, assigneesMap] = await Promise.all([
    db
      .select({
        parentId: tasks.parentId,
        total: sql<number>`count(*)::int`,
        completed: sql<number>`count(*) filter (where ${tasks.completed} = true)::int`,
      })
      .from(tasks)
      .where(and(isNotNull(tasks.parentId), inArray(tasks.parentId, taskIds)))
      .groupBy(tasks.parentId),
    db
      .select({
        taskId: taskAttachments.taskId,
        total: sql<number>`count(*)::int`,
      })
      .from(taskAttachments)
      .where(inArray(taskAttachments.taskId, taskIds))
      .groupBy(taskAttachments.taskId),
    db
      .select({
        taskId: taskDocs.taskId,
        total: sql<number>`count(*)::int`,
      })
      .from(taskDocs)
      .where(inArray(taskDocs.taskId, taskIds))
      .groupBy(taskDocs.taskId),
    batchFetchTaskAssignees(taskIds),
  ]);

  const statsMap = new Map<string, { total: number; completed: number }>();
  for (const s of subtaskStats) {
    if (s.parentId) {
      statsMap.set(s.parentId, {
        total: Number(s.total) || 0,
        completed: Number(s.completed) || 0,
      });
    }
  }

  const attachmentStatsMap = new Map<string, number>();
  for (const a of attachmentStats) {
    if (a.taskId) {
      attachmentStatsMap.set(a.taskId, Number(a.total) || 0);
    }
  }

  const docStatsMap = new Map<string, number>();
  for (const d of docStats) {
    if (d.taskId) {
      docStatsMap.set(d.taskId, Number(d.total) || 0);
    }
  }

  return rows.map((r) => {
    const stats = statsMap.get(r.task.id);
    return {
      ...r.task,
      tag: r.tag || null,
      project: r.project || null,
      status: r.status || null,
      parent: r.parent?.id ? r.parent : null,
      recurringRule: r.recurringRule || null,
      subtaskCount: stats?.total || 0,
      completedSubtaskCount: stats?.completed || 0,
      attachmentCount: attachmentStatsMap.get(r.task.id) || 0,
      docCount: docStatsMap.get(r.task.id) || 0,
      assignees: assigneesMap.get(r.task.id) || [],
    };
  });
}

export async function getWeekTasksInternal(
  userId: string,
  workspaceId: string,
  startDate: string,
  endDate: string
): Promise<TaskWithTag[]> {
  await projectRecurringTasksForWindow(userId, workspaceId, startDate, endDate);

  const parentTasks = alias(tasks, "parent_task");

  const rows = await db
    .select({
      task: tasks,
      tag: tags,
      project: projects,
      status: taskStatuses,
      parent: {
        id: parentTasks.id,
        title: parentTasks.title,
      },
      recurringRule: recurringRules,
    })
    .from(tasks)
    .leftJoin(tags, eq(tasks.tagId, tags.id))
    .leftJoin(projects, eq(tasks.projectId, projects.id))
    .leftJoin(taskStatuses, eq(tasks.statusId, taskStatuses.id))
    .leftJoin(parentTasks, eq(tasks.parentId, parentTasks.id))
    .leftJoin(recurringRules, eq(tasks.recurringRuleId, recurringRules.id))
    .where(
      and(
        eq(tasks.userId, userId),
        eq(tasks.workspaceId, workspaceId),
        or(
          and(gte(tasks.date, startDate), lte(tasks.date, endDate)),
          isNull(tasks.date),
          inArray(
            tasks.parentId,
            db
              .select({ id: tasks.id })
              .from(tasks)
              .where(
                and(
                  eq(tasks.userId, userId),
                  eq(tasks.workspaceId, workspaceId),
                  isNull(tasks.date)
                )
              )
          )
        )
      )
    )
    .orderBy(asc(tasks.order), asc(tasks.createdAt));

  return hydrateTaskRows(rows);
}

export async function getKanbanTasksInternal(
  userId: string,
  workspaceId: string
): Promise<TaskWithTag[]> {
  const rows = await db
    .select({
      task: tasks,
      tag: tags,
      project: projects,
      status: taskStatuses,
      recurringRule: recurringRules,
    })
    .from(tasks)
    .leftJoin(tags, eq(tasks.tagId, tags.id))
    .leftJoin(projects, eq(tasks.projectId, projects.id))
    .leftJoin(taskStatuses, eq(tasks.statusId, taskStatuses.id))
    .leftJoin(recurringRules, eq(tasks.recurringRuleId, recurringRules.id))
    .where(
      and(
        eq(tasks.userId, userId),
        eq(tasks.workspaceId, workspaceId),
        isNull(tasks.parentId)
      )
    )
    .orderBy(asc(tasks.order), asc(tasks.createdAt));

  return hydrateTaskRows(rows);
}

export async function getSubtasksInternal(
  userId: string,
  parentTaskId: string
): Promise<TaskWithTag[]> {
  const parentTasks = alias(tasks, "parent_task");
  const rows = await db
    .select({
      task: tasks,
      tag: tags,
      project: projects,
      parent: {
        id: parentTasks.id,
        title: parentTasks.title,
      },
    })
    .from(tasks)
    .leftJoin(tags, eq(tasks.tagId, tags.id))
    .leftJoin(projects, eq(tasks.projectId, projects.id))
    .leftJoin(parentTasks, eq(tasks.parentId, parentTasks.id))
    .where(
      and(
        eq(tasks.userId, userId),
        eq(tasks.parentId, parentTaskId)
      )
    )
    .orderBy(asc(tasks.order), asc(tasks.createdAt));

  const taskIds = rows.map((r) => r.task.id);
  const assigneesMap = await batchFetchTaskAssignees(taskIds);

  return rows.map((r) => ({
    ...r.task,
    tag: r.tag || null,
    project: r.project || null,
    parent: r.parent?.id ? r.parent : null,
    subtaskCount: 0,
    completedSubtaskCount: 0,
    assignees: assigneesMap.get(r.task.id) || [],
  }));
}

export async function getTaskByIdInternal(
  taskId: string,
  userId: string
): Promise<TaskWithTag> {
  const [taskRecord] = await db
    .select({ id: tasks.id, workspaceId: tasks.workspaceId })
    .from(tasks)
    .where(eq(tasks.id, taskId));

  if (!taskRecord) {
    throw new Error("Task not found.");
  }

  const [membership] = await db
    .select({ id: workspaceMembers.id })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, taskRecord.workspaceId),
        eq(workspaceMembers.userId, userId)
      )
    );

  if (!membership) {
    throw new Error("Task not found.");
  }

  const parentTasks = alias(tasks, "parent_task");
  const rows = await db
    .select({
      task: tasks,
      tag: tags,
      project: projects,
      status: taskStatuses,
      parent: {
        id: parentTasks.id,
        title: parentTasks.title,
      },
      recurringRule: recurringRules,
    })
    .from(tasks)
    .leftJoin(tags, eq(tasks.tagId, tags.id))
    .leftJoin(projects, eq(tasks.projectId, projects.id))
    .leftJoin(taskStatuses, eq(tasks.statusId, taskStatuses.id))
    .leftJoin(parentTasks, eq(tasks.parentId, parentTasks.id))
    .leftJoin(recurringRules, eq(tasks.recurringRuleId, recurringRules.id))
    .where(eq(tasks.id, taskId));

  if (!rows.length) {
    throw new Error("Task not found.");
  }

  const hydrated = await hydrateTaskRows(rows);
  return hydrated[0];
}
