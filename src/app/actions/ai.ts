"use server";

import { db } from "@/db";
import { aiThreads, aiMessages, AiThread, AiMessage } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { getActiveWorkspaceContext } from "@/lib/workspace";
import { and, eq, desc, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function getAiThreadsAction(): Promise<{
  threads?: AiThread[];
  activeThreadId?: string;
  error?: string;
}> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  try {
    const { activeWorkspace } = await getActiveWorkspaceContext(session.userId);

    const threads = await db
      .select()
      .from(aiThreads)
      .where(
        and(
          eq(aiThreads.workspaceId, activeWorkspace.id),
          eq(aiThreads.userId, session.userId)
        )
      )
      .orderBy(desc(aiThreads.updatedAt));

    return {
      threads,
      activeThreadId: threads.length > 0 ? threads[0].id : undefined,
    };
  } catch (err: unknown) {
    console.error("Error fetching AI threads:", err);
    return { error: "Failed to fetch conversations." };
  }
}

export async function createAiThreadAction(
  title: string = "New Chat"
): Promise<{ thread?: AiThread; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  try {
    const { activeWorkspace } = await getActiveWorkspaceContext(session.userId);
    const now = new Date();

    const [newThread] = await db
      .insert(aiThreads)
      .values({
        workspaceId: activeWorkspace.id,
        userId: session.userId,
        title: title.trim() || "New Chat",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    revalidatePath("/agent");
    return { thread: newThread };
  } catch (err: unknown) {
    console.error("Error creating AI thread:", err);
    return { error: "Failed to create conversation." };
  }
}

export async function getAiThreadMessagesAction(
  threadId: string
): Promise<{ messages?: AiMessage[]; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  try {
    const { activeWorkspace } = await getActiveWorkspaceContext(session.userId);

    // Verify ownership and workspace
    const [thread] = await db
      .select()
      .from(aiThreads)
      .where(
        and(
          eq(aiThreads.id, threadId),
          eq(aiThreads.workspaceId, activeWorkspace.id),
          eq(aiThreads.userId, session.userId)
        )
      );

    if (!thread) {
      return { error: "Conversation not found." };
    }

    const messages = await db
      .select()
      .from(aiMessages)
      .where(eq(aiMessages.threadId, threadId))
      .orderBy(asc(aiMessages.createdAt));

    return { messages };
  } catch (err: unknown) {
    console.error("Error fetching AI messages:", err);
    return { error: "Failed to load conversation messages." };
  }
}

export async function deleteAiThreadAction(
  threadId: string
): Promise<{ success?: boolean; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  try {
    const { activeWorkspace } = await getActiveWorkspaceContext(session.userId);

    await db
      .delete(aiThreads)
      .where(
        and(
          eq(aiThreads.id, threadId),
          eq(aiThreads.workspaceId, activeWorkspace.id),
          eq(aiThreads.userId, session.userId)
        )
      );

    revalidatePath("/agent");
    return { success: true };
  } catch (err: unknown) {
    console.error("Error deleting AI thread:", err);
    return { error: "Failed to delete conversation." };
  }
}

export async function renameAiThreadAction(
  threadId: string,
  title: string
): Promise<{ thread?: AiThread; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  const cleanTitle = title.trim();
  if (!cleanTitle) {
    return { error: "Title cannot be empty." };
  }

  try {
    const { activeWorkspace } = await getActiveWorkspaceContext(session.userId);

    const [updated] = await db
      .update(aiThreads)
      .set({
        title: cleanTitle.slice(0, 255),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(aiThreads.id, threadId),
          eq(aiThreads.workspaceId, activeWorkspace.id),
          eq(aiThreads.userId, session.userId)
        )
      )
      .returning();

    if (!updated) {
      return { error: "Conversation not found." };
    }

    revalidatePath("/agent");
    return { thread: updated };
  } catch (err: unknown) {
    console.error("Error renaming AI thread:", err);
    return { error: "Failed to rename conversation." };
  }
}
