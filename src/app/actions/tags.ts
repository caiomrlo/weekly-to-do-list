"use server";

import { db } from "@/db";
import { tags, Tag } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { getActiveWorkspaceContext } from "@/lib/workspace";
import { and, eq, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function getUserTagsAction(): Promise<{ tags?: Tag[]; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  try {
    const { activeWorkspace } = await getActiveWorkspaceContext(session.userId);

    const list = await db
      .select()
      .from(tags)
      .where(
        and(
          eq(tags.userId, session.userId),
          eq(tags.workspaceId, activeWorkspace.id)
        )
      )
      .orderBy(asc(tags.name));

    return { tags: list };
  } catch (err: unknown) {
    console.error("Error fetching tags:", err);
    return { error: "Failed to fetch tags." };
  }
}

export async function createTagAction(data: {
  name: string;
  color?: string;
}): Promise<{ tag?: Tag; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  const name = data.name.trim();
  if (!name) {
    return { error: "Tag name cannot be empty." };
  }

  if (name.length > 50) {
    return { error: "Tag name must be at most 50 characters." };
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
  const color = data.color && validColors.includes(data.color) ? data.color : "amber";

  try {
    const { activeWorkspace } = await getActiveWorkspaceContext(session.userId);
    const now = new Date();
    const [newTag] = await db
      .insert(tags)
      .values({
        workspaceId: activeWorkspace.id,
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
    console.error("Error creating tag:", err);
    return { error: "Failed to create tag." };
  }
}

export async function deleteTagAction(
  tagId: string
): Promise<{ success?: boolean; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  try {
    await db
      .delete(tags)
      .where(and(eq(tags.id, tagId), eq(tags.userId, session.userId)));

    revalidatePath("/");
    return { success: true };
  } catch (err: unknown) {
    console.error("Error deleting tag:", err);
    return { error: "Failed to delete tag." };
  }
}
