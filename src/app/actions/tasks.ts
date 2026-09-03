"use server";

import { db } from "@/db";
import { tasks, Task } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { and, eq, gte, lte, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function getWeekTasksAction(
  startDate: string,
  endDate: string
): Promise<{ tasks?: Task[]; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Não autenticado." };
  }

  try {
    const list = await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, session.userId),
          gte(tasks.date, startDate),
          lte(tasks.date, endDate)
        )
      )
      .orderBy(asc(tasks.createdAt));

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
}): Promise<{ task?: Task; error?: string }> {
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
    const [newTask] = await db
      .insert(tasks)
      .values({
        userId: session.userId,
        title,
        date: data.date,
        time: data.time?.trim() || null,
        content: "",
        completed: false,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

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
  }
): Promise<{ task?: Task; error?: string }> {
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

    const [updated] = await db
      .update(tasks)
      .set(updateValues)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, session.userId)))
      .returning();

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
