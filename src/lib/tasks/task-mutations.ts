import { db } from "@/db";
import {
  tasks,
  tags,
  projects,
  taskStatuses,
  taskAssignees,
  workspaceMembers,
  TaskWithTag,
} from "@/db/schema";
import { and, eq, desc, asc, isNull, sql, inArray } from "drizzle-orm";
import { getActiveWorkspaceContext } from "@/lib/workspace";
import { batchFetchTaskAssignees } from "./task-assignees";
import { deleteTasksInternal } from "./task-cleanup";
import {
  handleRecurringTaskFutureUpdate,
  handleRecurringTaskDelete,
} from "./task-recurrence";
import { getTaskByIdInternal } from "./task-queries";

export async function createTaskInternal(
  data: {
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
  },
  userId: string
): Promise<TaskWithTag> {
  const title = data.title.trim();
  if (!title) {
    throw new Error("Task title cannot be empty.");
  }

  let workspaceId = data.workspaceId;
  let parentObj: { id: string; title: string } | null = null;
  if (data.parentId) {
    const [parent] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, data.parentId), eq(tasks.userId, userId)));

    if (!parent) {
      throw new Error("Parent task not found.");
    }
    if (parent.parentId) {
      throw new Error("Cannot create a subtask of a subtask (maximum 1 level of nesting allowed).");
    }
    parentObj = { id: parent.id, title: parent.title };
    workspaceId = parent.workspaceId;
  }

  if (!workspaceId) {
    const { activeWorkspace } = await getActiveWorkspaceContext(userId);
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
        eq(tasks.userId, userId),
        eq(tasks.workspaceId, workspaceId),
        dateCondition
      )
    );
  const nextOrder = (maxOrderRow?.maxOrder ?? -1) + 1;

  const [inserted] = await db
    .insert(tasks)
    .values({
      workspaceId,
      userId,
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

  return {
    ...inserted,
    tag: tagObj,
    project: projectObj,
    status: statusObj,
    parent: parentObj,
    subtaskCount: 0,
    completedSubtaskCount: 0,
    assignees: assigneesMap.get(inserted.id) || [],
  };
}

export async function toggleTaskStatusInternal(
  taskId: string,
  completed: boolean,
  userId: string,
  workspaceId: string
): Promise<void> {
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
          eq(taskStatuses.workspaceId, workspaceId),
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
          eq(taskStatuses.workspaceId, workspaceId),
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
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));
}

export async function updateTaskInternal(
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
  },
  userId: string
): Promise<TaskWithTag> {
  const [currentTask] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));

  if (!currentTask) {
    throw new Error("Task not found.");
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
    await handleRecurringTaskFutureUpdate(
      currentTask,
      data,
      updateValues,
      now,
      userId
    );
  }

  await db
    .update(tasks)
    .set(updateValues)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));

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

  return getTaskByIdInternal(taskId, userId);
}

export async function deleteTaskInternalAction(
  taskId: string,
  deleteScope: "this" | "future" | "all" = "this",
  userId: string
): Promise<void> {
  const [task] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));

  if (!task) {
    throw new Error("Task not found.");
  }

  if (task.recurringRuleId) {
    await handleRecurringTaskDelete(task, deleteScope, userId);
  } else {
    await deleteTasksInternal([taskId], userId);
  }
}
