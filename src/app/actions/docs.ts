"use server";

import { db } from "@/db";
import {
  docs,
  taskDocs,
  tasks,
  projects,
  docAttachments,
  attachments,
  Doc,
  DocWithRelations,
} from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { getActiveWorkspaceContext } from "@/lib/workspace";
import { and, eq, desc, ilike, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export interface DocTaskRelation {
  id: string;
  title: string;
  completed: boolean;
  date?: string | null;
}

export async function getUserDocsAction(filters?: {
  projectId?: string;
  isFavorite?: boolean;
  search?: string;
}): Promise<{ docs?: DocWithRelations[]; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  try {
    const { activeWorkspace } = await getActiveWorkspaceContext(session.userId);
    const conditions = [
      eq(docs.userId, session.userId),
      eq(docs.workspaceId, activeWorkspace.id),
    ];

    if (filters?.projectId) {
      conditions.push(eq(docs.projectId, filters.projectId));
    }

    if (filters?.isFavorite !== undefined) {
      conditions.push(eq(docs.isFavorite, filters.isFavorite));
    }

    if (filters?.search && filters.search.trim()) {
      conditions.push(ilike(docs.title, `%${filters.search.trim()}%`));
    }

    const [rawDocs, taskCounts, attachmentCounts] = await Promise.all([
      db
        .select({
          doc: docs,
          project: projects,
        })
        .from(docs)
        .leftJoin(projects, eq(docs.projectId, projects.id))
        .where(and(...conditions))
        .orderBy(desc(docs.isFavorite), desc(docs.updatedAt)),
      db
        .select({
          docId: taskDocs.docId,
          total: sql<number>`count(*)::int`,
        })
        .from(taskDocs)
        .where(eq(taskDocs.userId, session.userId))
        .groupBy(taskDocs.docId),
      db
        .select({
          docId: docAttachments.docId,
          total: sql<number>`count(*)::int`,
        })
        .from(docAttachments)
        .where(eq(docAttachments.userId, session.userId))
        .groupBy(docAttachments.docId),
    ]);

    const countMap = new Map<string, number>();
    for (const item of taskCounts) {
      countMap.set(item.docId, Number(item.total) || 0);
    }

    const attCountMap = new Map<string, number>();
    for (const item of attachmentCounts) {
      attCountMap.set(item.docId, Number(item.total) || 0);
    }

    const result: DocWithRelations[] = rawDocs.map((r) => ({
      ...r.doc,
      project: r.project || null,
      taskCount: countMap.get(r.doc.id) || 0,
      attachmentCount: attCountMap.get(r.doc.id) || 0,
    }));

    return { docs: result };
  } catch (err: unknown) {
    console.error("Error fetching user docs:", err);
    return { error: "Failed to fetch documents." };
  }
}

export async function getDocByIdAction(
  docId: string
): Promise<{ doc?: DocWithRelations; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  try {
    const [row] = await db
      .select({
        doc: docs,
        project: projects,
      })
      .from(docs)
      .leftJoin(projects, eq(docs.projectId, projects.id))
      .where(and(eq(docs.id, docId), eq(docs.userId, session.userId)))
      .limit(1);

    if (!row) {
      return { error: "Document not found or access denied." };
    }

    const [linkedTasks, linkedAttachments] = await Promise.all([
      db
        .select({
          id: tasks.id,
          title: tasks.title,
          completed: tasks.completed,
          date: tasks.date,
        })
        .from(taskDocs)
        .innerJoin(tasks, eq(taskDocs.taskId, tasks.id))
        .where(and(eq(taskDocs.docId, docId), eq(taskDocs.userId, session.userId)))
        .orderBy(desc(tasks.createdAt)),
      db
        .select({
          attachment: attachments,
        })
        .from(docAttachments)
        .innerJoin(attachments, eq(docAttachments.attachmentId, attachments.id))
        .where(
          and(eq(docAttachments.docId, docId), eq(docAttachments.userId, session.userId))
        )
        .orderBy(desc(docAttachments.createdAt)),
    ]);

    const formattedAttachments = linkedAttachments.map(({ attachment }) => ({
      ...attachment,
      url: `/api/attachments/${attachment.id}`,
      thumbUrl: attachment.thumbnailPath
        ? `/api/attachments/${attachment.id}?thumb=1`
        : null,
    }));

    const docWithRel: DocWithRelations = {
      ...row.doc,
      project: row.project || null,
      taskCount: linkedTasks.length,
      tasks: linkedTasks,
      attachmentCount: formattedAttachments.length,
      attachments: formattedAttachments,
    };

    return { doc: docWithRel };
  } catch (err: unknown) {
    console.error("Error fetching document by ID:", err);
    return { error: "Failed to fetch document." };
  }
}

export async function createDocAction(data: {
  title?: string;
  content?: string;
  projectId?: string | null;
  isFavorite?: boolean;
}): Promise<{ doc?: DocWithRelations; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  const title = (data.title || "").trim() || "Untitled Document";
  const content = data.content || "";
  const projectId = data.projectId || null;
  const isFavorite = !!data.isFavorite;

  try {
    const { activeWorkspace } = await getActiveWorkspaceContext(session.userId);
    const now = new Date();
    const [newDoc] = await db
      .insert(docs)
      .values({
        workspaceId: activeWorkspace.id,
        userId: session.userId,
        projectId,
        title,
        content,
        isFavorite,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    let project = null;
    if (projectId) {
      const [projRow] = await db
        .select()
        .from(projects)
        .where(and(eq(projects.id, projectId), eq(projects.userId, session.userId)))
        .limit(1);
      project = projRow || null;
    }

    revalidatePath("/docs");
    revalidatePath("/");

    return {
      doc: {
        ...newDoc,
        project,
        taskCount: 0,
        tasks: [],
        attachmentCount: 0,
        attachments: [],
      },
    };
  } catch (err: unknown) {
    console.error("Error creating document:", err);
    return { error: "Failed to create document." };
  }
}

export async function updateDocAction(
  docId: string,
  updates: {
    title?: string;
    content?: string;
    projectId?: string | null;
    isFavorite?: boolean;
  }
): Promise<{ doc?: Doc; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  try {
    const patch: Partial<Doc> = {
      updatedAt: new Date(),
    };

    if (updates.title !== undefined) {
      patch.title = updates.title.trim() || "Untitled Document";
    }

    if (updates.content !== undefined) {
      patch.content = updates.content;
    }

    if (updates.projectId !== undefined) {
      patch.projectId = updates.projectId;
    }

    if (updates.isFavorite !== undefined) {
      patch.isFavorite = updates.isFavorite;
    }

    const [updated] = await db
      .update(docs)
      .set(patch)
      .where(and(eq(docs.id, docId), eq(docs.userId, session.userId)))
      .returning();

    if (!updated) {
      return { error: "Document not found or access denied." };
    }

    revalidatePath("/docs");
    revalidatePath("/");

    return { doc: updated };
  } catch (err: unknown) {
    console.error("Error updating document:", err);
    return { error: "Failed to update document." };
  }
}

export async function deleteDocAction(
  docId: string
): Promise<{ success?: boolean; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  try {
    await db
      .delete(docs)
      .where(and(eq(docs.id, docId), eq(docs.userId, session.userId)));

    revalidatePath("/docs");
    revalidatePath("/");

    return { success: true };
  } catch (err: unknown) {
    console.error("Error deleting document:", err);
    return { error: "Failed to delete document." };
  }
}

export async function toggleDocFavoriteAction(
  docId: string,
  isFavorite: boolean
): Promise<{ success?: boolean; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  try {
    await db
      .update(docs)
      .set({ isFavorite, updatedAt: new Date() })
      .where(and(eq(docs.id, docId), eq(docs.userId, session.userId)));

    revalidatePath("/docs");
    return { success: true };
  } catch (err: unknown) {
    console.error("Error toggling favorite:", err);
    return { error: "Failed to update favorite status." };
  }
}

export async function getTaskDocsAction(
  taskId: string
): Promise<{ docs?: DocWithRelations[]; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  try {
    const rows = await db
      .select({
        doc: docs,
        project: projects,
      })
      .from(taskDocs)
      .innerJoin(docs, eq(taskDocs.docId, docs.id))
      .leftJoin(projects, eq(docs.projectId, projects.id))
      .where(and(eq(taskDocs.taskId, taskId), eq(taskDocs.userId, session.userId)))
      .orderBy(desc(taskDocs.createdAt));

    const result: DocWithRelations[] = rows.map((r) => ({
      ...r.doc,
      project: r.project || null,
    }));

    return { docs: result };
  } catch (err: unknown) {
    console.error("Error fetching task docs:", err);
    return { error: "Failed to fetch task documents." };
  }
}

export async function linkDocToTaskAction(
  taskId: string,
  docId: string
): Promise<{ success?: boolean; doc?: DocWithRelations; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  try {
    const [task] = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, session.userId)))
      .limit(1);

    if (!task) {
      return { error: "Task not found or access denied." };
    }

    const [docRow] = await db
      .select({
        doc: docs,
        project: projects,
      })
      .from(docs)
      .leftJoin(projects, eq(docs.projectId, projects.id))
      .where(and(eq(docs.id, docId), eq(docs.userId, session.userId)))
      .limit(1);

    if (!docRow) {
      return { error: "Document not found or access denied." };
    }

    await db
      .insert(taskDocs)
      .values({
        taskId,
        docId,
        userId: session.userId,
      })
      .onConflictDoNothing();

    revalidatePath("/docs");
    revalidatePath("/");

    return {
      success: true,
      doc: {
        ...docRow.doc,
        project: docRow.project || null,
      },
    };
  } catch (err: unknown) {
    console.error("Error linking doc to task:", err);
    return { error: "Failed to link document." };
  }
}

export async function unlinkDocFromTaskAction(
  taskId: string,
  docId: string
): Promise<{ success?: boolean; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  try {
    await db
      .delete(taskDocs)
      .where(
        and(
          eq(taskDocs.taskId, taskId),
          eq(taskDocs.docId, docId),
          eq(taskDocs.userId, session.userId)
        )
      );

    revalidatePath("/docs");
    revalidatePath("/");

    return { success: true };
  } catch (err: unknown) {
    console.error("Error unlinking doc from task:", err);
    return { error: "Failed to unlink document." };
  }
}

export async function createAndLinkDocAction(
  taskId: string,
  data: {
    title: string;
    projectId?: string | null;
  }
): Promise<{ doc?: DocWithRelations; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  const trimmedTitle = data.title.trim();
  if (!trimmedTitle) {
    return { error: "Document title cannot be empty." };
  }

  try {
    const [task] = await db
      .select({ id: tasks.id, workspaceId: tasks.workspaceId })
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, session.userId)))
      .limit(1);

    if (!task) {
      return { error: "Task not found or access denied." };
    }

    const now = new Date();
    const [newDoc] = await db
      .insert(docs)
      .values({
        workspaceId: task.workspaceId,
        userId: session.userId,
        projectId: data.projectId || null,
        title: trimmedTitle,
        content: "",
        isFavorite: false,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    await db.insert(taskDocs).values({
      taskId,
      docId: newDoc.id,
      userId: session.userId,
    });

    let project = null;
    if (data.projectId) {
      const [projRow] = await db
        .select()
        .from(projects)
        .where(and(eq(projects.id, data.projectId), eq(projects.userId, session.userId)))
        .limit(1);
      project = projRow || null;
    }

    revalidatePath("/docs");
    revalidatePath("/");

    return {
      doc: {
        ...newDoc,
        project,
        taskCount: 1,
        attachmentCount: 0,
        attachments: [],
      },
    };
  } catch (err: unknown) {
    console.error("Error creating and linking doc:", err);
    return { error: "Failed to create document." };
  }
}
