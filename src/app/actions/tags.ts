"use server";

import { db } from "@/db";
import { tags, Tag } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { and, eq, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function getUserTagsAction(): Promise<{ tags?: Tag[]; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Não autenticado." };
  }

  try {
    const list = await db
      .select()
      .from(tags)
      .where(eq(tags.userId, session.userId))
      .orderBy(asc(tags.name));

    return { tags: list };
  } catch (err: unknown) {
    console.error("Erro ao buscar tags:", err);
    return { error: "Erro ao buscar tags." };
  }
}

export async function createTagAction(data: {
  name: string;
  color?: string;
}): Promise<{ tag?: Tag; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Não autenticado." };
  }

  const name = data.name.trim();
  if (!name) {
    return { error: "O nome da tag não pode estar vazio." };
  }

  if (name.length > 50) {
    return { error: "O nome da tag deve ter no máximo 50 caracteres." };
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
    const [newTag] = await db
      .insert(tags)
      .values({
        userId: session.userId,
        name,
        color,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    revalidatePath("/");
    return { tag: newTag };
  } catch (err: unknown) {
    console.error("Erro ao criar tag:", err);
    return { error: "Erro ao criar tag." };
  }
}

export async function deleteTagAction(
  tagId: string
): Promise<{ success?: boolean; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Não autenticado." };
  }

  try {
    await db
      .delete(tags)
      .where(and(eq(tags.id, tagId), eq(tags.userId, session.userId)));

    revalidatePath("/");
    return { success: true };
  } catch (err: unknown) {
    console.error("Erro ao excluir tag:", err);
    return { error: "Erro ao excluir tag." };
  }
}
