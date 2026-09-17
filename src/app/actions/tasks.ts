"use server";

import { db } from "@/db";
import {
  tasks,
  tags,
  projects,
  taskStatuses,
  attachments,
  taskDocs,
  docAttachments,
  taskAttachments,
  taskAssignees,
  users,
  workspaceMembers,
  recurringRules,
  TaskWithTag,
  TaskAssigneeUser,
  RecurrenceFrequency,
} from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { getActiveWorkspaceContext } from "@/lib/workspace";
import { deleteManyFromR2 } from "@/lib/r2";
import {
  and,
  eq,
  ne,
  gte,
  lte,
  asc,
  desc,
  isNotNull,
  sql,
  or,
  isNull,
  inArray,
  notInArray,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { revalidatePath } from "next/cache";
import {
  calculateProjectedDates,
  addDaysToStr,
  getDayOfWeekFromStr,
  parseDateParts,
} from "@/lib/recurrence-utils";
import { toDateString } from "@/lib/date-utils";

export async function batchFetchTaskAssignees(
  taskIds: string[]
): Promise<Map<string, TaskAssigneeUser[]>> {
  const map = new Map<string, TaskAssigneeUser[]>();
  if (taskIds.length === 0) return map;

  const rows = await db
    .select({
      taskId: taskAssignees.taskId,
      userId: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
    })
    .from(taskAssignees)
    .innerJoin(users, eq(taskAssignees.userId, users.id))
    .where(inArray(taskAssignees.taskId, taskIds))
    .orderBy(asc(taskAssignees.assignedAt));

  for (const row of rows) {
    const list = map.get(row.taskId) || [];
    list.push({
      id: row.userId,
      name: row.name,
      email: row.email,
      image: row.image,
    });
    map.set(row.taskId, list);
  }

  return map;
}

export async function getWeekTasksAction(
  startDate: string,
  endDate: string
): Promise<{ tasks?: TaskWithTag[]; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  try {
    const { activeWorkspace } = await getActiveWorkspaceContext(session.userId);

    // 1. On-demand window projection for recurring tasks
    const activeRules = await db
      .select()
      .from(recurringRules)
      .where(
        and(
          eq(recurringRules.userId, session.userId),
          eq(recurringRules.workspaceId, activeWorkspace.id),
          lte(recurringRules.startDate, endDate),
          or(isNull(recurringRules.endDate), gte(recurringRules.endDate, startDate))
        )
      );

    if (activeRules.length > 0) {
      const ruleProjections: Array<{ rule: typeof activeRules[0]; dates: string[] }> = [];
      const allProjectedDatesSet = new Set<string>();
      const activeRuleIds = activeRules.map((r) => r.id);

      for (const rule of activeRules) {
        const dates = calculateProjectedDates(rule, startDate, endDate);
        if (dates.length > 0) {
          ruleProjections.push({ rule, dates });
          for (const d of dates) allProjectedDatesSet.add(d);
        }
      }

      if (ruleProjections.length > 0) {
        const allProjectedDates = Array.from(allProjectedDatesSet);

        // Find existing tasks matching recurringRuleId and dates
        const existingTasks = await db
          .select({
            id: tasks.id,
            recurringRuleId: tasks.recurringRuleId,
            date: tasks.date,
            originalDate: tasks.originalDate,
          })
          .from(tasks)
          .where(
            and(
              eq(tasks.userId, session.userId),
              eq(tasks.workspaceId, activeWorkspace.id),
              inArray(tasks.recurringRuleId, activeRuleIds),
              or(
                inArray(tasks.date, allProjectedDates),
                inArray(tasks.originalDate, allProjectedDates)
              )
            )
          );

        const existingKeySet = new Set<string>();
        for (const t of existingTasks) {
          if (t.recurringRuleId) {
            if (t.originalDate) existingKeySet.add(`${t.recurringRuleId}_${t.originalDate}`);
            if (t.date) existingKeySet.add(`${t.recurringRuleId}_${t.date}`);
          }
        }

        const tasksToInsert: Array<typeof tasks.$inferInsert> = [];
        const now = new Date();

        for (const { rule, dates } of ruleProjections) {
          for (const pDate of dates) {
            if (!existingKeySet.has(`${rule.id}_${pDate}`)) {
              tasksToInsert.push({
                workspaceId: activeWorkspace.id,
                userId: session.userId,
                recurringRuleId: rule.id,
                originalDate: pDate,
                date: pDate,
                title: rule.title,
                content: rule.content,
                time: rule.time,
                duration: rule.duration,
                tagId: rule.tagId,
                projectId: rule.projectId,
                completed: false,
                order: 0,
                createdAt: now,
                updatedAt: now,
              });
              existingKeySet.add(`${rule.id}_${pDate}`);
            }
          }
        }

        if (tasksToInsert.length > 0) {
          await db.insert(tasks).values(tasksToInsert);
        }
      }
    }

    const parentTasks = alias(tasks, "parent_task");

    const [rows, subtaskStats, attachmentStats, docStats] = await Promise.all([
      db
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
            eq(tasks.userId, session.userId),
            eq(tasks.workspaceId, activeWorkspace.id),
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
                      eq(tasks.userId, session.userId),
                      eq(tasks.workspaceId, activeWorkspace.id),
                      isNull(tasks.date)
                    )
                  )
              )
            )
          )
        )
        .orderBy(asc(tasks.order), asc(tasks.createdAt)),
      db
        .select({
          parentId: tasks.parentId,
          total: sql<number>`count(*)::int`,
          completed: sql<number>`count(*) filter (where ${tasks.completed} = true)::int`,
        })
        .from(tasks)
        .where(and(eq(tasks.userId, session.userId), isNotNull(tasks.parentId)))
        .groupBy(tasks.parentId),
      db
        .select({
          taskId: taskAttachments.taskId,
          total: sql<number>`count(*)::int`,
        })
        .from(taskAttachments)
        .where(eq(taskAttachments.userId, session.userId))
        .groupBy(taskAttachments.taskId),
      db
        .select({
          taskId: taskDocs.taskId,
          total: sql<number>`count(*)::int`,
        })
        .from(taskDocs)
        .where(eq(taskDocs.userId, session.userId))
        .groupBy(taskDocs.taskId),
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

    const taskIds = rows.map((r) => r.task.id);
    const assigneesMap = await batchFetchTaskAssignees(taskIds);

    const list: TaskWithTag[] = rows.map((r) => {
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

    return { tasks: list };
  } catch (err: unknown) {
    console.error("Error fetching week tasks:", err);
    return { error: "Failed to fetch tasks." };
  }
}

export async function getSubtasksAction(
  parentTaskId: string
): Promise<{ subtasks?: TaskWithTag[]; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  try {
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
          eq(tasks.userId, session.userId),
          eq(tasks.parentId, parentTaskId)
        )
      )
      .orderBy(asc(tasks.order), asc(tasks.createdAt));

    const taskIds = rows.map((r) => r.task.id);
    const assigneesMap = await batchFetchTaskAssignees(taskIds);

    const list: TaskWithTag[] = rows.map((r) => ({
      ...r.task,
      tag: r.tag || null,
      project: r.project || null,
      parent: r.parent?.id ? r.parent : null,
      subtaskCount: 0,
      completedSubtaskCount: 0,
      assignees: assigneesMap.get(r.task.id) || [],
    }));

    return { subtasks: list };
  } catch (err: unknown) {
    console.error("Error fetching subtasks:", err);
    return { error: "Failed to fetch subtasks." };
  }
}

export async function getTaskByIdAction(
  taskId: string
): Promise<{ task?: TaskWithTag; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  try {
    const [taskRecord] = await db
      .select({ id: tasks.id, workspaceId: tasks.workspaceId })
      .from(tasks)
      .where(eq(tasks.id, taskId));

    if (!taskRecord) {
      return { error: "Task not found." };
    }

    const [membership] = await db
      .select({ id: workspaceMembers.id })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, taskRecord.workspaceId),
          eq(workspaceMembers.userId, session.userId)
        )
      );

    if (!membership) {
      return { error: "Task not found." };
    }

    const parentTasks = alias(tasks, "parent_task");
    const [rows, [stats], [attachmentStat], [docStat], assigneesMap] = await Promise.all([
      db
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
        .where(eq(tasks.id, taskId)),
      db
        .select({
          total: sql<number>`count(*)::int`,
          completed: sql<number>`count(*) filter (where ${tasks.completed} = true)::int`,
        })
        .from(tasks)
        .where(eq(tasks.parentId, taskId)),
      db
        .select({
          total: sql<number>`count(*)::int`,
        })
        .from(attachments)
        .where(eq(attachments.taskId, taskId)),
      db
        .select({
          total: sql<number>`count(*)::int`,
        })
        .from(taskDocs)
        .where(eq(taskDocs.taskId, taskId)),
      batchFetchTaskAssignees([taskId]),
    ]);

    if (!rows.length) {
      return { error: "Task not found." };
    }

    const item: TaskWithTag = {
      ...rows[0].task,
      tag: rows[0].tag || null,
      project: rows[0].project || null,
      status: rows[0].status || null,
      parent: rows[0].parent?.id ? rows[0].parent : null,
      recurringRule: rows[0].recurringRule || null,
      subtaskCount: stats?.total || 0,
      completedSubtaskCount: stats?.completed || 0,
      attachmentCount: attachmentStat?.total || 0,
      docCount: docStat?.total || 0,
      assignees: assigneesMap.get(taskId) || [],
    };

    return { task: item };
  } catch (err: unknown) {
    console.error("Error fetching task by ID:", err);
    return { error: "Failed to load task." };
  }
}

export async function createTaskAction(data: {
  title: string;
  date?: string | null;
  time?: string;
  duration?: number | null;
  tagId?: string | null;
  projectId?: string | null;
  statusId?: string | null;
  parentId?: string | null;
  workspaceId?: string;
  assigneeIds?: string[];
}): Promise<{ task?: TaskWithTag; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  const title = data.title.trim();
  if (!title) {
    return { error: "Task title cannot be empty." };
  }

  try {
    let workspaceId = data.workspaceId;
    let parentObj: { id: string; title: string } | null = null;
    if (data.parentId) {
      const [parent] = await db
        .select()
        .from(tasks)
        .where(and(eq(tasks.id, data.parentId), eq(tasks.userId, session.userId)));

      if (!parent) {
        return { error: "Parent task not found." };
      }
      if (parent.parentId) {
        return { error: "Cannot create a subtask of a subtask (maximum 1 level of nesting allowed)." };
      }
      parentObj = { id: parent.id, title: parent.title };
      workspaceId = parent.workspaceId;
    }

    if (!workspaceId) {
      const { activeWorkspace } = await getActiveWorkspaceContext(session.userId);
      workspaceId = activeWorkspace.id;
    }

    // Resolve statusId: if not provided, look for default status in workspace
    let resolvedStatusId = data.statusId || null;
    let isCompleted = false;
    if (resolvedStatusId) {
      const [foundStatus] = await db
        .select()
        .from(taskStatuses)
        .where(
          and(
            eq(taskStatuses.id, resolvedStatusId),
            eq(taskStatuses.workspaceId, workspaceId)
          )
        );
      if (foundStatus) {
        isCompleted = foundStatus.category === "done";
      }
    } else {
      const [defaultStatus] = await db
        .select()
        .from(taskStatuses)
        .where(
          and(
            eq(taskStatuses.workspaceId, workspaceId),
            eq(taskStatuses.category, "todo")
          )
        )
        .orderBy(desc(taskStatuses.isDefault), asc(taskStatuses.order))
        .limit(1);
      if (defaultStatus) {
        resolvedStatusId = defaultStatus.id;
        isCompleted = defaultStatus.category === "done";
      }
    }

    const targetDate = data.date && data.date.trim() ? data.date.trim() : null;
    const dateCondition = targetDate ? eq(tasks.date, targetDate) : isNull(tasks.date);

    const now = new Date();
    const [maxOrderRow] = await db
      .select({ maxOrder: sql<number>`coalesce(max(${tasks.order}), -1)::int` })
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, session.userId),
          eq(tasks.workspaceId, workspaceId),
          dateCondition
        )
      );
    const nextOrder = (maxOrderRow?.maxOrder ?? -1) + 1;

    const [inserted] = await db
      .insert(tasks)
      .values({
        workspaceId,
        userId: session.userId,
        tagId: data.tagId || null,
        projectId: data.projectId || null,
        statusId: resolvedStatusId,
        parentId: data.parentId || null,
        title,
        date: targetDate,
        time: targetDate ? (data.time?.trim() || null) : null,
        duration: data.duration ?? null,
        content: "",
        completed: isCompleted,
        order: nextOrder,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    let tagObj = null;
    if (inserted.tagId) {
      const [foundTag] = await db
        .select()
        .from(tags)
        .where(eq(tags.id, inserted.tagId));
      tagObj = foundTag || null;
    }

    let projectObj = null;
    if (inserted.projectId) {
      const [foundProject] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, inserted.projectId));
      projectObj = foundProject || null;
    }

    let statusObj = null;
    if (inserted.statusId) {
      const [foundStatus] = await db
        .select()
        .from(taskStatuses)
        .where(eq(taskStatuses.id, inserted.statusId));
      statusObj = foundStatus || null;
    }

    if (data.assigneeIds && data.assigneeIds.length > 0) {
      const validMembers = await db
        .select({ userId: workspaceMembers.userId })
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, workspaceId),
            inArray(workspaceMembers.userId, data.assigneeIds)
          )
        );
      const validMemberIds = validMembers.map((m) => m.userId);
      if (validMemberIds.length > 0) {
        await db.insert(taskAssignees).values(
          validMemberIds.map((uId) => ({
            taskId: inserted.id,
            userId: uId,
          }))
        );
      }
    }

    const assigneesMap = await batchFetchTaskAssignees([inserted.id]);

    const newTask: TaskWithTag = {
      ...inserted,
      tag: tagObj,
      project: projectObj,
      status: statusObj,
      parent: parentObj,
      subtaskCount: 0,
      completedSubtaskCount: 0,
      assignees: assigneesMap.get(inserted.id) || [],
    };

    revalidatePath("/");
    revalidatePath("/kanban");
    return { task: newTask };
  } catch (err: unknown) {
    console.error("Error creating task:", err);
    return { error: "Failed to create task." };
  }
}

export async function toggleTaskStatusAction(
  taskId: string,
  completed: boolean
): Promise<{ success?: boolean; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  try {
    const { activeWorkspace } = await getActiveWorkspaceContext(session.userId);

    const updatePayload: { completed: boolean; statusId?: string | null; updatedAt: Date } = {
      completed,
      updatedAt: new Date(),
    };

    if (completed) {
      const [doneStatus] = await db
        .select()
        .from(taskStatuses)
        .where(
          and(
            eq(taskStatuses.workspaceId, activeWorkspace.id),
            eq(taskStatuses.category, "done")
          )
        )
        .orderBy(desc(taskStatuses.isDefault), asc(taskStatuses.order))
        .limit(1);
      if (doneStatus) {
        updatePayload.statusId = doneStatus.id;
      }
    } else {
      const [todoStatus] = await db
        .select()
        .from(taskStatuses)
        .where(
          and(
            eq(taskStatuses.workspaceId, activeWorkspace.id),
            eq(taskStatuses.category, "todo")
          )
        )
        .orderBy(desc(taskStatuses.isDefault), asc(taskStatuses.order))
        .limit(1);
      if (todoStatus) {
        updatePayload.statusId = todoStatus.id;
      }
    }

    await db
      .update(tasks)
      .set(updatePayload)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, session.userId)));

    revalidatePath("/");
    revalidatePath("/kanban");
    return { success: true };
  } catch (err: unknown) {
    console.error("Error updating status:", err);
    return { error: "Failed to update status." };
  }
}

async function deleteTasksInternal(taskIds: string[], userId: string): Promise<void> {
  if (taskIds.length === 0) return;

  const childTasks = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(inArray(tasks.parentId, taskIds), eq(tasks.userId, userId)));
  const allIdsToDelete = Array.from(new Set([...taskIds, ...childTasks.map((t) => t.id)]));

  const taskAttachmentRows = await db
    .select({
      id: attachments.id,
      filePath: attachments.filePath,
      thumbnailPath: attachments.thumbnailPath,
    })
    .from(taskAttachments)
    .innerJoin(attachments, eq(taskAttachments.attachmentId, attachments.id))
    .where(
      and(
        inArray(taskAttachments.taskId, allIdsToDelete),
        eq(taskAttachments.userId, userId)
      )
    );

  if (taskAttachmentRows.length > 0) {
    const candidateIds = taskAttachmentRows.map((a) => a.id);

    const [linkedToOtherTasks, linkedToDocs] = await Promise.all([
      db
        .select({ attachmentId: taskAttachments.attachmentId })
        .from(taskAttachments)
        .where(
          and(
            inArray(taskAttachments.attachmentId, candidateIds),
            notInArray(taskAttachments.taskId, allIdsToDelete),
            eq(taskAttachments.userId, userId)
          )
        ),
      db
        .select({ attachmentId: docAttachments.attachmentId })
        .from(docAttachments)
        .where(
          and(
            inArray(docAttachments.attachmentId, candidateIds),
            eq(docAttachments.userId, userId)
          )
        ),
    ]);

    const otherTaskLinkedSet = new Set(linkedToOtherTasks.map((r) => r.attachmentId));
    const docLinkedSet = new Set(linkedToDocs.map((r) => r.attachmentId));

    const attachmentsToDelete = taskAttachmentRows.filter(
      (a) => !otherTaskLinkedSet.has(a.id) && !docLinkedSet.has(a.id)
    );

    if (attachmentsToDelete.length > 0) {
      const keysToDelete = attachmentsToDelete
        .flatMap((a) => [a.filePath, a.thumbnailPath])
        .filter((k): k is string => Boolean(k));

      await deleteManyFromR2(keysToDelete).catch((r2Err) =>
        console.error("Warning: Failed to delete R2 files during deleteTask:", r2Err)
      );

      await db.delete(attachments).where(
        and(
          inArray(
            attachments.id,
            attachmentsToDelete.map((a) => a.id)
          ),
          eq(attachments.userId, userId)
        )
      );
    }
  }

  await db
    .delete(tasks)
    .where(and(inArray(tasks.id, allIdsToDelete), eq(tasks.userId, userId)));
}

export async function updateTaskAction(
  taskId: string,
  data: {
    title?: string;
    content?: string;
    date?: string | null;
    time?: string | null;
    duration?: number | null;
    tagId?: string | null;
    projectId?: string | null;
    statusId?: string | null;
    editScope?: "this" | "future";
    assigneeIds?: string[];
  }
): Promise<{ task?: TaskWithTag; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  try {
    const [currentTask] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, session.userId)));

    if (!currentTask) {
      return { error: "Task not found." };
    }

    const now = new Date();
    const updateValues: Partial<typeof tasks.$inferInsert> = {
      updatedAt: now,
    };

    if (data.title !== undefined) updateValues.title = data.title.trim();
    if (data.content !== undefined) updateValues.content = data.content;
    if (data.date !== undefined) updateValues.date = data.date && data.date.trim() ? data.date.trim() : null;
    if (data.time !== undefined) updateValues.time = data.time ? data.time.trim() : null;
    if (data.duration !== undefined) updateValues.duration = data.duration && data.duration > 0 ? data.duration : null;
    if (data.tagId !== undefined) updateValues.tagId = data.tagId ? data.tagId : null;
    if (data.projectId !== undefined) updateValues.projectId = data.projectId ? data.projectId : null;
    if (data.statusId !== undefined) {
      updateValues.statusId = data.statusId ? data.statusId : null;
      if (data.statusId) {
        const [targetStatus] = await db
          .select()
          .from(taskStatuses)
          .where(eq(taskStatuses.id, data.statusId));
        if (targetStatus) {
          updateValues.completed = targetStatus.category === "done";
        }
      }
    }

    if (data.editScope === "future" && currentTask.recurringRuleId) {
      const currDate = currentTask.originalDate || currentTask.date;

      const ruleUpdateValues: Partial<typeof recurringRules.$inferInsert> = {
        updatedAt: now,
      };
      if (data.title !== undefined) ruleUpdateValues.title = data.title.trim();
      if (data.content !== undefined) ruleUpdateValues.content = data.content;
      if (data.time !== undefined) ruleUpdateValues.time = data.time ? data.time.trim() : null;
      if (data.duration !== undefined) ruleUpdateValues.duration = data.duration && data.duration > 0 ? data.duration : null;
      if (data.tagId !== undefined) ruleUpdateValues.tagId = data.tagId ? data.tagId : null;
      if (data.projectId !== undefined) ruleUpdateValues.projectId = data.projectId ? data.projectId : null;

      await db
        .update(recurringRules)
        .set(ruleUpdateValues)
        .where(
          and(
            eq(recurringRules.id, currentTask.recurringRuleId),
            eq(recurringRules.userId, session.userId)
          )
        );

      const futureUpdates: Partial<typeof tasks.$inferInsert> = { ...updateValues };
      delete futureUpdates.date;

      if (currDate) {
        await db
          .update(tasks)
          .set(futureUpdates)
          .where(
            and(
              eq(tasks.recurringRuleId, currentTask.recurringRuleId),
              eq(tasks.userId, session.userId),
              or(gte(tasks.date, currDate), gte(tasks.originalDate, currDate))
            )
          );
      }
    }

    await db
      .update(tasks)
      .set(updateValues)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, session.userId)));

    if (data.assigneeIds !== undefined) {
      await db.delete(taskAssignees).where(eq(taskAssignees.taskId, taskId));
      if (data.assigneeIds.length > 0) {
        const validMembers = await db
          .select({ userId: workspaceMembers.userId })
          .from(workspaceMembers)
          .where(
            and(
              eq(workspaceMembers.workspaceId, currentTask.workspaceId),
              inArray(workspaceMembers.userId, data.assigneeIds)
            )
          );
        const validMemberIds = validMembers.map((m) => m.userId);
        if (validMemberIds.length > 0) {
          await db.insert(taskAssignees).values(
            validMemberIds.map((uId) => ({
              taskId,
              userId: uId,
            }))
          );
        }
      }
    }

    const parentTasks = alias(tasks, "parent_task");
    const [rows, [stats], [attachmentStat], [docStat], assigneesMap] = await Promise.all([
      db
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
        .where(and(eq(tasks.id, taskId), eq(tasks.userId, session.userId))),
      db
        .select({
          total: sql<number>`count(*)::int`,
          completed: sql<number>`count(*) filter (where ${tasks.completed} = true)::int`,
        })
        .from(tasks)
        .where(and(eq(tasks.userId, session.userId), eq(tasks.parentId, taskId))),
      db
        .select({
          total: sql<number>`count(*)::int`,
        })
        .from(taskAttachments)
        .where(and(eq(taskAttachments.userId, session.userId), eq(taskAttachments.taskId, taskId))),
      db
        .select({
          total: sql<number>`count(*)::int`,
        })
        .from(taskDocs)
        .where(and(eq(taskDocs.userId, session.userId), eq(taskDocs.taskId, taskId))),
      batchFetchTaskAssignees([taskId]),
    ]);

    if (!rows.length) {
      return { error: "Task not found." };
    }

    const updated: TaskWithTag = {
      ...rows[0].task,
      tag: rows[0].tag || null,
      project: rows[0].project || null,
      status: rows[0].status || null,
      parent: rows[0].parent?.id ? rows[0].parent : null,
      recurringRule: rows[0].recurringRule || null,
      subtaskCount: stats?.total || 0,
      completedSubtaskCount: stats?.completed || 0,
      attachmentCount: attachmentStat?.total || 0,
      docCount: docStat?.total || 0,
      assignees: assigneesMap.get(taskId) || [],
    };

    revalidatePath("/");
    revalidatePath("/kanban");
    return { task: updated };
  } catch (err: unknown) {
    console.error("Error updating task:", err);
    return { error: "Failed to save task changes." };
  }
}

export async function updateTaskRecurrenceAction(params: {
  taskId: string;
  frequency: RecurrenceFrequency | "none";
  interval?: number;
  daysOfWeek?: number[];
  dayOfMonth?: number;
  monthOfYear?: number;
  endDate?: string | null;
  currentWeekRange?: { startDate: string; endDate: string };
}): Promise<{
  task?: TaskWithTag;
  newTasks?: TaskWithTag[];
  deletedTaskIds?: string[];
  error?: string;
}> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  try {
    const [currentTask] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, params.taskId), eq(tasks.userId, session.userId)));

    if (!currentTask) {
      return { error: "Task not found." };
    }

    const now = new Date();

    if (params.frequency === "none") {
      let deletedIds: string[] = [];
      if (currentTask.recurringRuleId) {
        const otherTasks = await db
          .select({ id: tasks.id })
          .from(tasks)
          .where(
            and(
              eq(tasks.recurringRuleId, currentTask.recurringRuleId),
              ne(tasks.id, currentTask.id),
              eq(tasks.userId, session.userId)
            )
          );
        deletedIds = otherTasks.map((t) => t.id);
        if (deletedIds.length > 0) {
          await deleteTasksInternal(deletedIds, session.userId);
        }

        await db
          .delete(recurringRules)
          .where(
            and(
              eq(recurringRules.id, currentTask.recurringRuleId),
              eq(recurringRules.userId, session.userId)
            )
          );

        await db
          .update(tasks)
          .set({
            recurringRuleId: null,
            originalDate: null,
            updatedAt: now,
          })
          .where(eq(tasks.id, currentTask.id));
      }

      const updatedRes = await getTaskByIdAction(currentTask.id);
      revalidatePath("/");
      return { task: updatedRes.task, deletedTaskIds: deletedIds };
    }

    // Setting or updating recurrence
    const baseDate = currentTask.date || toDateString(now);
    const defaultDay = getDayOfWeekFromStr(baseDate);
    const resolvedDays =
      params.frequency === "weekly"
        ? params.daysOfWeek && params.daysOfWeek.length > 0
          ? params.daysOfWeek
          : [defaultDay]
        : null;
    const resolvedDayOfMonth =
      params.frequency === "monthly" || params.frequency === "yearly"
        ? params.dayOfMonth || parseDateParts(baseDate).day
        : null;
    const resolvedMonthOfYear =
      params.frequency === "yearly"
        ? params.monthOfYear || parseDateParts(baseDate).month
        : null;

    let ruleId = currentTask.recurringRuleId;
    let deletedIds: string[] = [];

    if (ruleId) {
      // Update existing recurring rule
      await db
        .update(recurringRules)
        .set({
          frequency: params.frequency,
          interval: Math.max(1, params.interval || 1),
          daysOfWeek: resolvedDays,
          dayOfMonth: resolvedDayOfMonth,
          monthOfYear: resolvedMonthOfYear,
          startDate: baseDate,
          endDate: params.endDate || null,
          exceptions: [],
          title: currentTask.title,
          content: currentTask.content,
          time: currentTask.time,
          duration: currentTask.duration,
          tagId: currentTask.tagId,
          projectId: currentTask.projectId,
          updatedAt: now,
        })
        .where(
          and(
            eq(recurringRules.id, ruleId),
            eq(recurringRules.userId, session.userId)
          )
        );

      // Delete other tasks created from the old recurrence pattern
      const otherTasks = await db
        .select({ id: tasks.id })
        .from(tasks)
        .where(
          and(
            eq(tasks.recurringRuleId, ruleId),
            ne(tasks.id, currentTask.id),
            eq(tasks.userId, session.userId)
          )
        );
      deletedIds = otherTasks.map((t) => t.id);
      if (deletedIds.length > 0) {
        await deleteTasksInternal(deletedIds, session.userId);
      }

      // Update current task to reflect baseDate
      await db
        .update(tasks)
        .set({
          date: baseDate,
          originalDate: baseDate,
          updatedAt: now,
        })
        .where(eq(tasks.id, currentTask.id));
    } else {
      // Create new recurring rule
      const [newRule] = await db
        .insert(recurringRules)
        .values({
          workspaceId: currentTask.workspaceId,
          userId: session.userId,
          frequency: params.frequency,
          interval: Math.max(1, params.interval || 1),
          daysOfWeek: resolvedDays,
          dayOfMonth: resolvedDayOfMonth,
          monthOfYear: resolvedMonthOfYear,
          startDate: baseDate,
          endDate: params.endDate || null,
          exceptions: [],
          title: currentTask.title,
          content: currentTask.content,
          time: currentTask.time,
          duration: currentTask.duration,
          tagId: currentTask.tagId,
          projectId: currentTask.projectId,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      ruleId = newRule.id;

      // Update current task
      await db
        .update(tasks)
        .set({
          date: baseDate,
          originalDate: baseDate,
          recurringRuleId: ruleId,
          updatedAt: now,
        })
        .where(eq(tasks.id, currentTask.id));
    }

    // Materialize occurrences for the current window if provided
    let newlyCreatedTasks: TaskWithTag[] = [];
    if (params.currentWeekRange && ruleId) {
      const [rule] = await db
        .select()
        .from(recurringRules)
        .where(eq(recurringRules.id, ruleId));

      if (rule) {
        const projectedDates = calculateProjectedDates(
          rule,
          params.currentWeekRange.startDate,
          params.currentWeekRange.endDate
        );
        const datesToMaterialize = projectedDates.filter((d) => d !== baseDate);

        if (datesToMaterialize.length > 0) {
          const inserted = await db
            .insert(tasks)
            .values(
              datesToMaterialize.map((d) => ({
                workspaceId: currentTask.workspaceId,
                userId: session.userId,
                recurringRuleId: rule.id,
                originalDate: d,
                date: d,
                title: rule.title,
                content: rule.content,
                time: rule.time,
                duration: rule.duration,
                tagId: rule.tagId,
                projectId: rule.projectId,
                completed: false,
                order: 0,
                createdAt: now,
                updatedAt: now,
              }))
            )
            .returning();

          newlyCreatedTasks = inserted.map((ins) => ({
            ...ins,
            tag: null,
            project: null,
            parent: null,
            recurringRule: rule,
            subtaskCount: 0,
            completedSubtaskCount: 0,
            attachmentCount: 0,
            docCount: 0,
          }));
        }
      }
    }

    const updatedRes = await getTaskByIdAction(currentTask.id);
    revalidatePath("/");
    return {
      task: updatedRes.task,
      newTasks: newlyCreatedTasks,
      deletedTaskIds: deletedIds,
    };
  } catch (err: unknown) {
    console.error("Error updating task recurrence:", err);
    return { error: "Failed to update recurrence." };
  }
}

export async function deleteTaskAction(
  taskId: string,
  deleteScope: "this" | "future" | "all" = "this"
): Promise<{ success?: boolean; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  try {
    const [task] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, session.userId)));

    if (!task) {
      return { error: "Task not found." };
    }

    if (task.recurringRuleId) {
      const [rule] = await db
        .select()
        .from(recurringRules)
        .where(
          and(
            eq(recurringRules.id, task.recurringRuleId),
            eq(recurringRules.userId, session.userId)
          )
        );

      if (deleteScope === "all") {
        const allTasks = await db
          .select({ id: tasks.id })
          .from(tasks)
          .where(
            and(
              eq(tasks.recurringRuleId, task.recurringRuleId),
              eq(tasks.userId, session.userId)
            )
          );
        await deleteTasksInternal(
          allTasks.map((t) => t.id),
          session.userId
        );
        await db
          .delete(recurringRules)
          .where(
            and(
              eq(recurringRules.id, task.recurringRuleId),
              eq(recurringRules.userId, session.userId)
            )
          );
      } else if (deleteScope === "future") {
        const currDate = task.originalDate || task.date;
        if (currDate) {
          const futureTasks = await db
            .select({ id: tasks.id })
            .from(tasks)
            .where(
              and(
                eq(tasks.recurringRuleId, task.recurringRuleId),
                eq(tasks.userId, session.userId),
                or(gte(tasks.date, currDate), gte(tasks.originalDate, currDate))
              )
            );
          await deleteTasksInternal(
            futureTasks.map((t) => t.id),
            session.userId
          );

          if (rule) {
            const dayBefore = addDaysToStr(currDate, -1);
            if (dayBefore < rule.startDate) {
              await db
                .delete(recurringRules)
                .where(eq(recurringRules.id, rule.id));
            } else {
              await db
                .update(recurringRules)
                .set({ endDate: dayBefore, updatedAt: new Date() })
                .where(eq(recurringRules.id, rule.id));
            }
          }
        } else {
          await deleteTasksInternal([taskId], session.userId);
        }
      } else {
        // "this" occurrence only
        const currDate = task.originalDate || task.date;
        if (rule && currDate) {
          const currentExceptions = rule.exceptions || [];
          if (!currentExceptions.includes(currDate)) {
            await db
              .update(recurringRules)
              .set({
                exceptions: [...currentExceptions, currDate],
                updatedAt: new Date(),
              })
              .where(eq(recurringRules.id, rule.id));
          }
        }
        await deleteTasksInternal([taskId], session.userId);
      }
    } else {
      await deleteTasksInternal([taskId], session.userId);
    }

    revalidatePath("/");
    return { success: true };
  } catch (err: unknown) {
    console.error("Error deleting task:", err);
    return { error: "Failed to delete task." };
  }
}

export async function moveOrReorderTasksAction(params: {
  taskId: string;
  targetDate?: string | null;
  targetParentId: string | null;
  targetOrderedIds: string[];
  sourceOrderedIds?: string[];
  originalDate?: string | null;
  moveSameDaySubtasks?: boolean;
}): Promise<{ success?: boolean; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  try {
    const {
      taskId,
      targetDate,
      targetParentId,
      targetOrderedIds,
      sourceOrderedIds,
      originalDate,
      moveSameDaySubtasks,
    } = params;

    const resolvedTargetDate = targetDate && targetDate.trim() ? targetDate.trim() : null;
    const resolvedOriginalDate = originalDate && originalDate.trim() ? originalDate.trim() : null;

    const [task] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, session.userId)));

    if (!task) {
      return { error: "Task not found." };
    }

    if (targetParentId) {
      if (targetParentId === taskId) {
        return { error: "A task cannot be a subtask of itself." };
      }

      const [targetParent] = await db
        .select()
        .from(tasks)
        .where(and(eq(tasks.id, targetParentId), eq(tasks.userId, session.userId)));

      if (!targetParent) {
        return { error: "Target task not found." };
      }

      if (targetParent.parentId) {
        return { error: "Cannot create a subtask of a subtask (maximum 1 level of nesting allowed)." };
      }

      const [existingSubtask] = await db
        .select({ id: tasks.id })
        .from(tasks)
        .where(and(eq(tasks.userId, session.userId), eq(tasks.parentId, taskId)))
        .limit(1);

      if (existingSubtask) {
        return { error: "A task that already has subtasks cannot be converted into a subtask." };
      }
    }

    const now = new Date();

    if (moveSameDaySubtasks && resolvedOriginalDate && resolvedOriginalDate !== resolvedTargetDate && resolvedTargetDate) {
      await db
        .update(tasks)
        .set({
          date: resolvedTargetDate,
          updatedAt: now,
        })
        .where(
          and(
            eq(tasks.userId, session.userId),
            eq(tasks.parentId, taskId),
            eq(tasks.date, resolvedOriginalDate)
          )
        );
    }

    await db
      .update(tasks)
      .set({
        date: resolvedTargetDate,
        parentId: targetParentId,
        updatedAt: now,
      })
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, session.userId)));

    if (targetOrderedIds && targetOrderedIds.length > 0) {
      await Promise.all(
        targetOrderedIds.map((id, index) =>
          db
            .update(tasks)
            .set({ order: index, updatedAt: now })
            .where(and(eq(tasks.id, id), eq(tasks.userId, session.userId)))
        )
      );
    }

    if (sourceOrderedIds && sourceOrderedIds.length > 0) {
      await Promise.all(
        sourceOrderedIds.map((id, index) =>
          db
            .update(tasks)
            .set({ order: index, updatedAt: now })
            .where(and(eq(tasks.id, id), eq(tasks.userId, session.userId)))
        )
      );
    }

    revalidatePath("/");
    return { success: true };
  } catch (err: unknown) {
    console.error("Error moving/reordering tasks:", err);
    return { error: "Failed to save task order." };
  }
}

export async function getKanbanTasksAction(): Promise<{ tasks?: TaskWithTag[]; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  try {
    const { activeWorkspace } = await getActiveWorkspaceContext(session.userId);

    const [rows, subtaskStats, attachmentStats, docStats] = await Promise.all([
      db
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
            eq(tasks.userId, session.userId),
            eq(tasks.workspaceId, activeWorkspace.id),
            isNull(tasks.parentId)
          )
        )
        .orderBy(asc(tasks.order), asc(tasks.createdAt)),
      db
        .select({
          parentId: tasks.parentId,
          total: sql<number>`count(*)::int`,
          completed: sql<number>`count(*) filter (where ${tasks.completed} = true)::int`,
        })
        .from(tasks)
        .where(and(eq(tasks.userId, session.userId), isNotNull(tasks.parentId)))
        .groupBy(tasks.parentId),
      db
        .select({
          taskId: taskAttachments.taskId,
          total: sql<number>`count(*)::int`,
        })
        .from(taskAttachments)
        .where(eq(taskAttachments.userId, session.userId))
        .groupBy(taskAttachments.taskId),
      db
        .select({
          taskId: taskDocs.taskId,
          total: sql<number>`count(*)::int`,
        })
        .from(taskDocs)
        .where(eq(taskDocs.userId, session.userId))
        .groupBy(taskDocs.taskId),
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

    const taskIds = rows.map((r) => r.task.id);
    const assigneesMap = await batchFetchTaskAssignees(taskIds);

    const list: TaskWithTag[] = rows.map((r) => {
      const stats = statsMap.get(r.task.id);
      return {
        ...r.task,
        tag: r.tag || null,
        project: r.project || null,
        status: r.status || null,
        parent: null,
        recurringRule: r.recurringRule || null,
        subtaskCount: stats?.total || 0,
        completedSubtaskCount: stats?.completed || 0,
        attachmentCount: attachmentStatsMap.get(r.task.id) || 0,
        docCount: docStatsMap.get(r.task.id) || 0,
        assignees: assigneesMap.get(r.task.id) || [],
      };
    });

    return { tasks: list };
  } catch (err: unknown) {
    console.error("Error fetching kanban tasks:", err);
    return { error: "Failed to fetch kanban tasks." };
  }
}

export async function moveTaskKanbanAction(params: {
  taskId: string;
  targetStatusId: string;
  targetOrderedIds: string[];
}): Promise<{ success?: boolean; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  try {
    const { taskId, targetStatusId, targetOrderedIds } = params;
    const { activeWorkspace } = await getActiveWorkspaceContext(session.userId);

    const [task] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, session.userId)));

    if (!task) {
      return { error: "Task not found." };
    }

    const [targetStatus] = await db
      .select()
      .from(taskStatuses)
      .where(
        and(
          eq(taskStatuses.id, targetStatusId),
          eq(taskStatuses.workspaceId, activeWorkspace.id)
        )
      );

    if (!targetStatus) {
      return { error: "Target status not found." };
    }

    const isCompleted = targetStatus.category === "done";
    const now = new Date();

    await db
      .update(tasks)
      .set({
        statusId: targetStatusId,
        completed: isCompleted,
        updatedAt: now,
      })
      .where(eq(tasks.id, taskId));

    if (targetOrderedIds && targetOrderedIds.length > 0) {
      const reorderPromises = targetOrderedIds.map((id, index) =>
        db
          .update(tasks)
          .set({ order: index, updatedAt: now })
          .where(and(eq(tasks.id, id), eq(tasks.userId, session.userId)))
      );
      await Promise.all(reorderPromises);
    }

    revalidatePath("/");
    revalidatePath("/kanban");
    return { success: true };
  } catch (err: unknown) {
    console.error("Error moving task in kanban:", err);
    return { error: "Failed to move task." };
  }
}

export async function updateTaskAssigneesAction(
  taskId: string,
  userIds: string[]
): Promise<{ assignees?: TaskAssigneeUser[]; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  try {
    const [task] = await db
      .select({ id: tasks.id, workspaceId: tasks.workspaceId })
      .from(tasks)
      .where(eq(tasks.id, taskId));

    if (!task) {
      return { error: "Task not found." };
    }

    const [membership] = await db
      .select({ id: workspaceMembers.id })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, task.workspaceId),
          eq(workspaceMembers.userId, session.userId)
        )
      );

    if (!membership) {
      return { error: "Task not found." };
    }

    if (userIds.length > 0) {
      const validMembers = await db
        .select({ userId: workspaceMembers.userId })
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, task.workspaceId),
            inArray(workspaceMembers.userId, userIds)
          )
        );

      const validUserIdSet = new Set(validMembers.map((m) => m.userId));
      const hasInvalidUser = userIds.some((id) => !validUserIdSet.has(id));
      if (hasInvalidUser) {
        return { error: "One or more users are not members of this workspace." };
      }
    }

    await db.transaction(async (tx) => {
      await tx.delete(taskAssignees).where(eq(taskAssignees.taskId, taskId));

      if (userIds.length > 0) {
        const uniqueUserIds = Array.from(new Set(userIds));
        await tx.insert(taskAssignees).values(
          uniqueUserIds.map((userId) => ({
            taskId,
            userId,
          }))
        );
      }
    });

    const assigneesMap = await batchFetchTaskAssignees([taskId]);
    const updatedAssignees = assigneesMap.get(taskId) || [];

    revalidatePath("/");
    revalidatePath("/kanban");
    return { assignees: updatedAssignees };
  } catch (err: unknown) {
    console.error("Error updating task assignees:", err);
    return { error: "Failed to update task assignees." };
  }
}

