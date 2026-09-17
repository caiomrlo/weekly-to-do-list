import { db } from "@/db";
import { tasks, taskStatuses } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export async function moveOrReorderTasksInternal(
  params: {
    taskId: string;
    targetDate?: string | null;
    targetParentId: string | null;
    targetOrderedIds: string[];
    sourceOrderedIds?: string[];
    originalDate?: string | null;
    moveSameDaySubtasks?: boolean;
  },
  userId: string
): Promise<void> {
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
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));

  if (!task) {
    throw new Error("Task not found.");
  }

  if (targetParentId) {
    if (targetParentId === taskId) {
      throw new Error("A task cannot be a subtask of itself.");
    }

    const [targetParent] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, targetParentId), eq(tasks.userId, userId)));

    if (!targetParent) {
      throw new Error("Target task not found.");
    }

    if (targetParent.parentId) {
      throw new Error("Cannot create a subtask of a subtask (maximum 1 level of nesting allowed).");
    }

    const [existingSubtask] = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(eq(tasks.userId, userId), eq(tasks.parentId, taskId)))
      .limit(1);

    if (existingSubtask) {
      throw new Error("A task that already has subtasks cannot be converted into a subtask.");
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
          eq(tasks.userId, userId),
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
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));

  if (targetOrderedIds && targetOrderedIds.length > 0) {
    await Promise.all(
      targetOrderedIds.map((id, index) =>
        db
          .update(tasks)
          .set({ order: index, updatedAt: now })
          .where(and(eq(tasks.id, id), eq(tasks.userId, userId)))
      )
    );
  }

  if (sourceOrderedIds && sourceOrderedIds.length > 0) {
    await Promise.all(
      sourceOrderedIds.map((id, index) =>
        db
          .update(tasks)
          .set({ order: index, updatedAt: now })
          .where(and(eq(tasks.id, id), eq(tasks.userId, userId)))
      )
    );
  }
}

export async function moveTaskKanbanInternal(
  params: {
    taskId: string;
    targetStatusId: string;
    targetOrderedIds: string[];
  },
  userId: string,
  workspaceId: string
): Promise<void> {
  const { taskId, targetStatusId, targetOrderedIds } = params;

  const [task] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));

  if (!task) {
    throw new Error("Task not found.");
  }

  const [targetStatus] = await db
    .select()
    .from(taskStatuses)
    .where(
      and(
        eq(taskStatuses.id, targetStatusId),
        eq(taskStatuses.workspaceId, workspaceId)
      )
    );

  if (!targetStatus) {
    throw new Error("Target status not found.");
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
        .where(and(eq(tasks.id, id), eq(tasks.userId, userId)))
    );
    await Promise.all(reorderPromises);
  }
}
