"use server";

import { db } from "@/db";
import { projects, Project } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { and, eq, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function getUserProjectsAction(): Promise<{ projects?: Project[]; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Não autenticado." };
  }

  try {
    const list = await db
      .select()
      .from(projects)
      .where(eq(projects.userId, session.userId))
      .orderBy(asc(projects.name));

    return { projects: list };
  } catch (err: unknown) {
    console.error("Erro ao buscar projetos:", err);
    return { error: "Erro ao buscar projetos." };
  }
}

export async function createProjectAction(data: {
  name: string;
  color?: string;
}): Promise<{ project?: Project; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Não autenticado." };
  }

  const name = data.name.trim();
  if (!name) {
    return { error: "O nome do projeto não pode estar vazio." };
  }

  if (name.length > 50) {
    return { error: "O nome do projeto deve ter no máximo 50 caracteres." };
  }

  const validColors = [
    "indigo",
    "violet",
    "emerald",
    "amber",
    "rose",
    "sky",
    "orange",
    "slate",
  ];
  const color = data.color && validColors.includes(data.color) ? data.color : "indigo";

  try {
    const now = new Date();
    const [newProject] = await db
      .insert(projects)
      .values({
        userId: session.userId,
        name,
        color,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    revalidatePath("/");
    return { project: newProject };
  } catch (err: unknown) {
    console.error("Erro ao criar projeto:", err);
    return { error: "Erro ao criar projeto." };
  }
}

export async function deleteProjectAction(
  projectId: string
): Promise<{ success?: boolean; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Não autenticado." };
  }

  try {
    await db
      .delete(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, session.userId)));

    revalidatePath("/");
    return { success: true };
  } catch (err: unknown) {
    console.error("Erro ao excluir projeto:", err);
    return { error: "Erro ao excluir projeto." };
  }
}
