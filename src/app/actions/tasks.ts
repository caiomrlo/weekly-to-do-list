"use server";

import { db } from "@/db";
import { tasks, tags, attachments, TaskWithTag } from "@/db/schema";
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
    return { error: "Não autenticado." };
  }

  try {
    const parentTasks = alias(tasks, "parent_task");

    const [rows, subtaskStats, attachmentStats] = await Promise.all([
      db
        .select({
          task: tasks,
          tag: tags,
          parent: {
            id: parentTasks.id,
            title: parentTasks.title,
          },
        })
        .from(tasks)
        .leftJoin(tags, eq(tasks.tagId, tags.id))
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

    const list: TaskWithTag[] = rows.map((r) => {
      const stats = statsMap.get(r.task.id);
      return {
        ...r.task,
        tag: r.tag || null,
        parent: r.parent?.id ? r.parent : null,
        subtaskCount: stats?.total || 0,
        completedSubtaskCount: stats?.completed || 0,
        attachmentCount: attachmentStatsMap.get(r.task.id) || 0,
      };
    });

    return { tasks: list };
  } catch (err: unknown) {
    console.error("Erro ao buscar tarefas da semana:", err);
    return { error: "Erro ao buscar tarefas." };
  }
}

export async function getSubtasksAction(
  parentTaskId: string
): Promise<{ subtasks?: TaskWithTag[]; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Não autenticado." };
  }

  try {
    const parentTasks = alias(tasks, "parent_task");
    const rows = await db
      .select({
        task: tasks,
        tag: tags,
        parent: {
          id: parentTasks.id,
          title: parentTasks.title,
        },
      })
      .from(tasks)
      .leftJoin(tags, eq(tasks.tagId, tags.id))
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
      parent: r.parent?.id ? r.parent : null,
      subtaskCount: 0,
      completedSubtaskCount: 0,
    }));

    return { subtasks: list };
  } catch (err: unknown) {
    console.error("Erro ao buscar subtarefas:", err);
    return { error: "Erro ao buscar subtarefas." };
  }
}

export async function getTaskByIdAction(
  taskId: string
): Promise<{ task?: TaskWithTag; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Não autenticado." };
  }

  try {
    const parentTasks = alias(tasks, "parent_task");
    const [rows, [stats], [attachmentStat]] = await Promise.all([
      db
        .select({
          task: tasks,
          tag: tags,
          parent: {
            id: parentTasks.id,
            title: parentTasks.title,
          },
        })
        .from(tasks)
        .leftJoin(tags, eq(tasks.tagId, tags.id))
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
      return { error: "Tarefa não encontrada." };
    }

    const item: TaskWithTag = {
      ...rows[0].task,
      tag: rows[0].tag || null,
      parent: rows[0].parent?.id ? rows[0].parent : null,
      subtaskCount: stats?.total || 0,
      completedSubtaskCount: stats?.completed || 0,
      attachmentCount: attachmentStat?.total || 0,
    };

    return { task: item };
  } catch (err: unknown) {
    console.error("Erro ao buscar tarefa por ID:", err);
    return { error: "Erro ao carregar tarefa." };
  }
}

export async function createTaskAction(data: {
  title: string;
  date?: string | null;
  time?: string;
  duration?: number | null;
  tagId?: string | null;
  parentId?: string | null;
}): Promise<{ task?: TaskWithTag; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Não autenticado." };
  }

  const title = data.title.trim();
  if (!title) {
    return { error: "O título da tarefa não pode estar vazio." };
  }

  try {
    let parentObj: { id: string; title: string } | null = null;
    if (data.parentId) {
      const [parent] = await db
        .select()
        .from(tasks)
        .where(and(eq(tasks.id, data.parentId), eq(tasks.userId, session.userId)));

      if (!parent) {
        return { error: "Tarefa principal não encontrada." };
      }
      if (parent.parentId) {
        return { error: "Não é permitido criar subtarefa de uma subtarefa (limite de 1 nível)." };
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

    const newTask: TaskWithTag = {
      ...inserted,
      tag: tagObj,
      parent: parentObj,
      subtaskCount: 0,
      completedSubtaskCount: 0,
    };

    revalidatePath("/");
    return { task: newTask };
  } catch (err: unknown) {
    console.error("Erro ao criar tarefa:", err);
    return { error: "Erro ao criar tarefa." };
  }
}

export async function toggleTaskStatusAction(
  taskId: string,
  completed: boolean
): Promise<{ success?: boolean; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Não autenticado." };
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
    console.error("Erro ao atualizar status:", err);
    return { error: "Erro ao atualizar status." };
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
  }
): Promise<{ task?: TaskWithTag; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Não autenticado." };
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
          parent: {
            id: parentTasks.id,
            title: parentTasks.title,
          },
        })
        .from(tasks)
        .leftJoin(tags, eq(tasks.tagId, tags.id))
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
      return { error: "Tarefa não encontrada." };
    }

    const updated: TaskWithTag = {
      ...rows[0].task,
      tag: rows[0].tag || null,
      parent: rows[0].parent?.id ? rows[0].parent : null,
      subtaskCount: stats?.total || 0,
      completedSubtaskCount: stats?.completed || 0,
      attachmentCount: attachmentStat?.total || 0,
    };

    revalidatePath("/");
    return { task: updated };
  } catch (err: unknown) {
    console.error("Erro ao atualizar tarefa:", err);
    return { error: "Erro ao salvar alterações da tarefa." };
  }
}

export async function deleteTaskAction(
  taskId: string
): Promise<{ success?: boolean; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Não autenticado." };
  }

  try {
    // 1. Busca anexos da tarefa e de suas subtarefas para limpeza no Cloudflare R2
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
      .select({ filePath: attachments.filePath })
      .from(attachments)
      .where(
        and(
          inArray(attachments.taskId, taskIdsToDelete),
          eq(attachments.userId, session.userId)
        )
      );

    if (taskAttachments.length > 0) {
      await deleteManyFromR2(taskAttachments.map((a) => a.filePath)).catch((r2Err) =>
        console.error("Aviso: Falha ao excluir arquivos do R2 durante deleteTaskAction:", r2Err)
      );
    }

    // 2. Exclui a tarefa no banco (cascade cuidará de subtarefas e linhas de attachments)
    await db
      .delete(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, session.userId)));

    revalidatePath("/");
    return { success: true };
  } catch (err: unknown) {
    console.error("Erro ao excluir tarefa:", err);
    return { error: "Erro ao excluir tarefa." };
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
    return { error: "Não autenticado." };
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

    // 1. Verificar propriedade da tarefa
    const [task] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, session.userId)));

    if (!task) {
      return { error: "Tarefa não encontrada." };
    }

    // 2. Se for aninhar em um pai, validar regras de 1 nível de aninhamento
    if (targetParentId) {
      if (targetParentId === taskId) {
        return { error: "Uma tarefa não pode ser subtarefa de si mesma." };
      }

      const [targetParent] = await db
        .select()
        .from(tasks)
        .where(and(eq(tasks.id, targetParentId), eq(tasks.userId, session.userId)));

      if (!targetParent) {
        return { error: "Tarefa de destino não encontrada." };
      }

      if (targetParent.parentId) {
        return { error: "Não é permitido criar subtarefa de uma subtarefa (limite de 1 nível)." };
      }

      // Garantir que a tarefa arrastada não possua subtarefas (pois criaria 2 níveis)
      const [existingSubtask] = await db
        .select({ id: tasks.id })
        .from(tasks)
        .where(and(eq(tasks.userId, session.userId), eq(tasks.parentId, taskId)))
        .limit(1);

      if (existingSubtask) {
        return { error: "Uma tarefa que já possui subtarefas não pode ser transformada em subtarefa." };
      }
    }

    const now = new Date();

    // 3. Se a tarefa pai mudou de dia e solicitou mover subtarefas do mesmo dia
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

    // 4. Atualizar a tarefa movida (data, parentId)
    await db
      .update(tasks)
      .set({
        date: resolvedTargetDate,
        parentId: targetParentId,
        updatedAt: now,
      })
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, session.userId)));

    // 5. Atualizar ordem no container de destino
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

    // 6. Atualizar ordem no container de origem (se houver)
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
    console.error("Erro ao mover/reordenar tarefas:", err);
    return { error: "Erro ao salvar ordenação das tarefas." };
  }
}


