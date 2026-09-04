"use server";

import { db } from "@/db";
import { tasks, tags, TaskWithTag } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { and, eq, gte, lte, asc } from "drizzle-orm";
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
    const rows = await db
      .select({
        task: tasks,
        tag: tags,
      })
      .from(tasks)
      .leftJoin(tags, eq(tasks.tagId, tags.id))
      .where(
        and(
          eq(tasks.userId, session.userId),
          gte(tasks.date, startDate),
          lte(tasks.date, endDate)
        )
      )
      .orderBy(asc(tasks.createdAt));

    const list: TaskWithTag[] = rows.map((r) => ({
      ...r.task,
      tag: r.tag || null,
    }));

    return { tasks: list };
  } catch (err: unknown) {
    console.error("Erro ao buscar tarefas da semana:", err);
    return { error: "Erro ao buscar tarefas." };
  }
}

export async function createTaskAction(data: {
  title: string;
  date: string;
  time?: string;
  duration?: number | null;
  tagId?: string | null;
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
    const now = new Date();
    const [inserted] = await db
      .insert(tasks)
      .values({
        userId: session.userId,
        tagId: data.tagId || null,
        title,
        date: data.date,
        time: data.time?.trim() || null,
        duration: data.duration ?? null,
        content: "",
        completed: false,
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
    date?: string;
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
    if (data.date !== undefined) updateValues.date = data.date;
    if (data.time !== undefined) updateValues.time = data.time ? data.time.trim() : null;
    if (data.duration !== undefined) updateValues.duration = data.duration && data.duration > 0 ? data.duration : null;
    if (data.tagId !== undefined) updateValues.tagId = data.tagId ? data.tagId : null;

    await db
      .update(tasks)
      .set(updateValues)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, session.userId)));

    const rows = await db
      .select({
        task: tasks,
        tag: tags,
      })
      .from(tasks)
      .leftJoin(tags, eq(tasks.tagId, tags.id))
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, session.userId)));

    if (!rows.length) {
      return { error: "Tarefa não encontrada." };
    }

    const updated: TaskWithTag = {
      ...rows[0].task,
      tag: rows[0].tag || null,
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

