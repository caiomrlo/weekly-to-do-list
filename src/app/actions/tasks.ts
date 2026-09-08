"use server";

import { db } from "@/db";
import { tasks, tags, projects, attachments, taskDocs, TaskWithTag } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { deleteManyFromR2 } from "@/lib/r2";
import { and, eq, gte, lte, asc, isNotNull, sql, or, isNull, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { revalidatePath } from "next/cache";

export async function getWeekTasksAction(
  startDate: string,
  endDate: string
): Promise<{ tasks?: TaskWithTag[]; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  try {
    const parentTasks = alias(tasks, "parent_task");

    const [rows, subtaskStats, attachmentStats, docStats] = await Promise.all([
      db
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
            or(
              and(gte(tasks.date, startDate), lte(tasks.date, endDate)),
              isNull(tasks.date),
              inArray(
                tasks.parentId,
                db
                  .select({ id: tasks.id })
                  .from(tasks)
                  .where(and(eq(tasks.userId, session.userId), isNull(tasks.date)))
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
          taskId: attachments.taskId,
          total: sql<number>`count(*)::int`,
        })
        .from(attachments)
        .where(eq(attachments.userId, session.userId))
        .groupBy(attachments.taskId),
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

    const list: TaskWithTag[] = rows.map((r) => {
      const stats = statsMap.get(r.task.id);
      return {
        ...r.task,
        tag: r.tag || null,
        project: r.project || null,
        parent: r.parent?.id ? r.parent : null,
        subtaskCount: stats?.total || 0,
        completedSubtaskCount: stats?.completed || 0,
        attachmentCount: attachmentStatsMap.get(r.task.id) || 0,
        docCount: docStatsMap.get(r.task.id) || 0,
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

    const list: TaskWithTag[] = rows.map((r) => ({
      ...r.task,
      tag: r.tag || null,
      project: r.project || null,
      parent: r.parent?.id ? r.parent : null,
      subtaskCount: 0,
      completedSubtaskCount: 0,
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
    const parentTasks = alias(tasks, "parent_task");
    const [rows, [stats], [attachmentStat], [docStat]] = await Promise.all([
      db
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
        .from(attachments)
        .where(and(eq(attachments.userId, session.userId), eq(attachments.taskId, taskId))),
      db
        .select({
          total: sql<number>`count(*)::int`,
        })
        .from(taskDocs)
        .where(and(eq(taskDocs.userId, session.userId), eq(taskDocs.taskId, taskId))),
    ]);

    if (!rows.length) {
      return { error: "Task not found." };
    }

    const item: TaskWithTag = {
      ...rows[0].task,
      tag: rows[0].tag || null,
      project: rows[0].project || null,
      parent: rows[0].parent?.id ? rows[0].parent : null,
      subtaskCount: stats?.total || 0,
      completedSubtaskCount: stats?.completed || 0,
      attachmentCount: attachmentStat?.total || 0,
      docCount: docStat?.total || 0,
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
  parentId?: string | null;
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
    }

    const targetDate = data.date && data.date.trim() ? data.date.trim() : null;
    const dateCondition = targetDate ? eq(tasks.date, targetDate) : isNull(tasks.date);

    const now = new Date();
    const [maxOrderRow] = await db
      .select({ maxOrder: sql<number>`coalesce(max(${tasks.order}), -1)::int` })
      .from(tasks)
      .where(and(eq(tasks.userId, session.userId), dateCondition));
    const nextOrder = (maxOrderRow?.maxOrder ?? -1) + 1;

    const [inserted] = await db
      .insert(tasks)
      .values({
        userId: session.userId,
        tagId: data.tagId || null,
        projectId: data.projectId || null,
        parentId: data.parentId || null,
        title,
        date: targetDate,
        time: targetDate ? (data.time?.trim() || null) : null,
        duration: data.duration ?? null,
        content: "",
        completed: false,
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

    const newTask: TaskWithTag = {
      ...inserted,
      tag: tagObj,
      project: projectObj,
      parent: parentObj,
      subtaskCount: 0,
      completedSubtaskCount: 0,
    };

    revalidatePath("/");
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
    await db
      .update(tasks)
      .set({
        completed,
        updatedAt: new Date(),
      })
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, session.userId)));

    revalidatePath("/");
    return { success: true };
  } catch (err: unknown) {
    console.error("Error updating status:", err);
    return { error: "Failed to update status." };
  }
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
  }
): Promise<{ task?: TaskWithTag; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  try {
    const updateValues: Partial<typeof tasks.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (data.title !== undefined) updateValues.title = data.title.trim();
    if (data.content !== undefined) updateValues.content = data.content;
    if (data.date !== undefined) updateValues.date = data.date && data.date.trim() ? data.date.trim() : null;
    if (data.time !== undefined) updateValues.time = data.time ? data.time.trim() : null;
    if (data.duration !== undefined) updateValues.duration = data.duration && data.duration > 0 ? data.duration : null;
    if (data.tagId !== undefined) updateValues.tagId = data.tagId ? data.tagId : null;
    if (data.projectId !== undefined) updateValues.projectId = data.projectId ? data.projectId : null;

    await db
      .update(tasks)
      .set(updateValues)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, session.userId)));

    const parentTasks = alias(tasks, "parent_task");
    const [rows, [stats], [attachmentStat]] = await Promise.all([
      db
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
        .from(attachments)
        .where(and(eq(attachments.userId, session.userId), eq(attachments.taskId, taskId))),
    ]);

    if (!rows.length) {
      return { error: "Task not found." };
    }

    const updated: TaskWithTag = {
      ...rows[0].task,
      tag: rows[0].tag || null,
      project: rows[0].project || null,
      parent: rows[0].parent?.id ? rows[0].parent : null,
      subtaskCount: stats?.total || 0,
      completedSubtaskCount: stats?.completed || 0,
      attachmentCount: attachmentStat?.total || 0,
    };

    revalidatePath("/");
    return { task: updated };
  } catch (err: unknown) {
    console.error("Error updating task:", err);
    return { error: "Failed to save task changes." };
  }
}

export async function deleteTaskAction(
  taskId: string
): Promise<{ success?: boolean; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  try {
    const taskIdsToDelete = [
      taskId,
      ...(
        await db
          .select({ id: tasks.id })
          .from(tasks)
          .where(and(eq(tasks.parentId, taskId), eq(tasks.userId, session.userId)))
      ).map((t) => t.id),
    ];

    const taskAttachments = await db
      .select({
        filePath: attachments.filePath,
        thumbnailPath: attachments.thumbnailPath,
      })
      .from(attachments)
      .where(
        and(
          inArray(attachments.taskId, taskIdsToDelete),
          eq(attachments.userId, session.userId)
        )
      );

    if (taskAttachments.length > 0) {
      const keysToDelete = taskAttachments
        .flatMap((a) => [a.filePath, a.thumbnailPath])
        .filter((k): k is string => Boolean(k));

      await deleteManyFromR2(keysToDelete).catch((r2Err) =>
        console.error("Warning: Failed to delete R2 files during deleteTaskAction:", r2Err)
      );
    }

    // Cascade deletes child subtasks and attachment records via DB foreign key
    await db
      .delete(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, session.userId)));

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
