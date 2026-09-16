"use server";

import { db } from "@/db";
import {
  attachments,
  tasks,
  docs,
  docAttachments,
  taskAttachments,
  Attachment,
} from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import {
  uploadToR2,
  deleteFromR2,
  generateFilePath,
  generateThumbnailPath,
} from "@/lib/r2";
import { eq, and, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import sharp from "sharp";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export interface AttachmentWithUrl extends Attachment {
  url: string;
  thumbUrl?: string | null;
}

export async function getTaskAttachmentsAction(
  taskId: string
): Promise<{ attachments?: AttachmentWithUrl[]; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  try {
    const rows = await db
      .select({
        attachment: attachments,
      })
      .from(taskAttachments)
      .innerJoin(attachments, eq(taskAttachments.attachmentId, attachments.id))
      .where(
        and(
          eq(taskAttachments.taskId, taskId),
          eq(taskAttachments.userId, session.userId)
        )
      )
      .orderBy(desc(taskAttachments.createdAt));

    const list: AttachmentWithUrl[] = rows.map(({ attachment }) => ({
      ...attachment,
      url: `/api/attachments/${attachment.id}`,
      thumbUrl: attachment.thumbnailPath
        ? `/api/attachments/${attachment.id}?thumb=1`
        : null,
    }));

    return { attachments: list };
  } catch (err: unknown) {
    console.error("Error fetching task attachments:", err);
    return { error: "Failed to fetch task attachments." };
  }
}

export async function getDocAttachmentsAction(
  docId: string
): Promise<{ attachments?: AttachmentWithUrl[]; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  try {
    const rows = await db
      .select({
        attachment: attachments,
      })
      .from(docAttachments)
      .innerJoin(attachments, eq(docAttachments.attachmentId, attachments.id))
      .where(
        and(eq(docAttachments.docId, docId), eq(docAttachments.userId, session.userId))
      )
      .orderBy(desc(docAttachments.createdAt));

    const list: AttachmentWithUrl[] = rows.map(({ attachment }) => ({
      ...attachment,
      url: `/api/attachments/${attachment.id}`,
      thumbUrl: attachment.thumbnailPath
        ? `/api/attachments/${attachment.id}?thumb=1`
        : null,
    }));

    return { attachments: list };
  } catch (err: unknown) {
    console.error("Error fetching doc attachments:", err);
    return { error: "Failed to fetch document attachments." };
  }
}

export async function uploadAttachmentAction(
  formData: FormData
): Promise<{ attachment?: AttachmentWithUrl; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  const taskId = formData.get("taskId");
  const docId = formData.get("docId");
  const file = formData.get("file");

  const validTaskId = typeof taskId === "string" && taskId.trim() ? taskId.trim() : null;
  const validDocId = typeof docId === "string" && docId.trim() ? docId.trim() : null;

  if (!validTaskId && !validDocId) {
    return { error: "Invalid target: taskId or docId is required." };
  }

  if (!file || !(file instanceof File)) {
    return { error: "No file provided." };
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return {
      error:
        "Unsupported format. Only images (PNG, JPG, WebP, GIF) and PDF documents are allowed.",
    };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      error: `The file exceeds the maximum allowed limit of ${
        MAX_FILE_SIZE_BYTES / (1024 * 1024)
      }MB.`,
    };
  }

  if (validTaskId) {
    const [task] = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(eq(tasks.id, validTaskId), eq(tasks.userId, session.userId)))
      .limit(1);

    if (!task) {
      return { error: "Task not found or access denied." };
    }
  }

  if (validDocId) {
    const [doc] = await db
      .select({ id: docs.id })
      .from(docs)
      .where(and(eq(docs.id, validDocId), eq(docs.userId, session.userId)))
      .limit(1);

    if (!doc) {
      return { error: "Document not found or access denied." };
    }
  }

  const attachmentId = randomUUID();
  const filePath = generateFilePath(attachmentId, file.name);
  let thumbnailPath: string | null = null;

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await uploadToR2(filePath, buffer, file.type);

    if (file.type.startsWith("image/")) {
      try {
        const thumbBuffer = await sharp(buffer)
          .resize({
            width: 400,
            height: 400,
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp({ quality: 80 })
          .toBuffer();

        const generatedThumbPath = generateThumbnailPath(attachmentId);
        await uploadToR2(generatedThumbPath, thumbBuffer, "image/webp");
        thumbnailPath = generatedThumbPath;
      } catch (thumbErr) {
        console.warn(
          "Failed to generate thumbnail with sharp. Falling back to original image:",
          thumbErr
        );
      }
    }

    try {
      const [inserted] = await db
        .insert(attachments)
        .values({
          id: attachmentId,
          taskId: validTaskId,
          userId: session.userId,
          fileName: file.name,
          filePath,
          thumbnailPath,
          contentType: file.type,
          fileSize: file.size,
        })
        .returning();

      if (validTaskId) {
        await db.insert(taskAttachments).values({
          taskId: validTaskId,
          attachmentId: inserted.id,
          userId: session.userId,
        });
      }

      if (validDocId) {
        await db.insert(docAttachments).values({
          docId: validDocId,
          attachmentId: inserted.id,
          userId: session.userId,
        });
      }

      revalidatePath("/");
      if (validDocId) {
        revalidatePath("/docs");
        revalidatePath(`/docs/${validDocId}`);
      }

      return {
        attachment: {
          ...inserted,
          url: `/api/attachments/${inserted.id}`,
          thumbUrl: inserted.thumbnailPath
            ? `/api/attachments/${inserted.id}?thumb=1`
            : null,
        },
      };
    } catch (dbErr) {
      // Rollback R2 upload if database insert fails
      console.error("Failed to save attachment to database. Rolling back R2 upload:", dbErr);
      await deleteFromR2(filePath).catch((r2Err) =>
        console.error("Failed to rollback original file from R2:", r2Err)
      );
      if (thumbnailPath) {
        await deleteFromR2(thumbnailPath).catch((r2Err) =>
          console.error("Failed to rollback thumbnail from R2:", r2Err)
        );
      }
      throw dbErr;
    }
  } catch (err: unknown) {
    console.error("Error uploading attachment:", err);
    return { error: "Failed to upload file. Please check your connection and try again." };
  }
}

export async function linkAttachmentToDocAction(
  docId: string,
  attachmentId: string
): Promise<{ success?: boolean; attachment?: AttachmentWithUrl; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  try {
    const [doc] = await db
      .select({ id: docs.id })
      .from(docs)
      .where(and(eq(docs.id, docId), eq(docs.userId, session.userId)))
      .limit(1);

    if (!doc) {
      return { error: "Document not found or access denied." };
    }

    const [att] = await db
      .select()
      .from(attachments)
      .where(and(eq(attachments.id, attachmentId), eq(attachments.userId, session.userId)))
      .limit(1);

    if (!att) {
      return { error: "Attachment not found or access denied." };
    }

    await db
      .insert(docAttachments)
      .values({
        docId,
        attachmentId,
        userId: session.userId,
      })
      .onConflictDoNothing();

    revalidatePath("/docs");
    revalidatePath(`/docs/${docId}`);

    return {
      success: true,
      attachment: {
        ...att,
        url: `/api/attachments/${att.id}`,
        thumbUrl: att.thumbnailPath ? `/api/attachments/${att.id}?thumb=1` : null,
      },
    };
  } catch (err: unknown) {
    console.error("Error linking attachment to doc:", err);
    return { error: "Failed to link attachment to document." };
  }
}

export async function unlinkAttachmentFromDocAction(
  docId: string,
  attachmentId: string
): Promise<{ success?: boolean; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  try {
    await db
      .delete(docAttachments)
      .where(
        and(
          eq(docAttachments.docId, docId),
          eq(docAttachments.attachmentId, attachmentId),
          eq(docAttachments.userId, session.userId)
        )
      );

    revalidatePath("/docs");
    revalidatePath(`/docs/${docId}`);

    return { success: true };
  } catch (err: unknown) {
    console.error("Error unlinking attachment from doc:", err);
    return { error: "Failed to unlink attachment." };
  }
}

export async function getUserAvailableAttachmentsAction(
  docId: string
): Promise<{ attachments?: AttachmentWithUrl[]; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  try {
    const linked = await db
      .select({ attachmentId: docAttachments.attachmentId })
      .from(docAttachments)
      .where(
        and(eq(docAttachments.docId, docId), eq(docAttachments.userId, session.userId))
      );

    const linkedIds = new Set(linked.map((r) => r.attachmentId));

    const allUserAttachments = await db
      .select()
      .from(attachments)
      .where(eq(attachments.userId, session.userId))
      .orderBy(desc(attachments.createdAt));

    const available = allUserAttachments
      .filter((att) => !linkedIds.has(att.id))
      .map((att) => ({
        ...att,
        url: `/api/attachments/${att.id}`,
        thumbUrl: att.thumbnailPath ? `/api/attachments/${att.id}?thumb=1` : null,
      }));

    return { attachments: available };
  } catch (err: unknown) {
    console.error("Error fetching available attachments:", err);
    return { error: "Failed to fetch user attachments." };
  }
}

export async function deleteAttachmentAction(
  attachmentId: string
): Promise<{ success?: boolean; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  try {
    const [existing] = await db
      .select({
        id: attachments.id,
        filePath: attachments.filePath,
        thumbnailPath: attachments.thumbnailPath,
      })
      .from(attachments)
      .where(
        and(eq(attachments.id, attachmentId), eq(attachments.userId, session.userId))
      )
      .limit(1);

    if (!existing) {
      return { error: "Attachment not found or access denied." };
    }

    await deleteFromR2(existing.filePath);
    if (existing.thumbnailPath) {
      await deleteFromR2(existing.thumbnailPath).catch((err) =>
        console.warn("Warning deleting thumbnail from R2:", err)
      );
    }

    await db.delete(attachments).where(eq(attachments.id, attachmentId));

    revalidatePath("/");
    revalidatePath("/docs");

    return { success: true };
  } catch (err: unknown) {
    console.error("Error deleting attachment:", err);
    return { error: "Failed to delete attachment." };
  }
}

export async function linkAttachmentToTaskAction(
  taskId: string,
  attachmentId: string
): Promise<{ success?: boolean; attachment?: AttachmentWithUrl; error?: string }> {
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

    const [att] = await db
      .select()
      .from(attachments)
      .where(and(eq(attachments.id, attachmentId), eq(attachments.userId, session.userId)))
      .limit(1);

    if (!att) {
      return { error: "Attachment not found or access denied." };
    }

    await db
      .insert(taskAttachments)
      .values({
        taskId,
        attachmentId,
        userId: session.userId,
      })
      .onConflictDoNothing();

    revalidatePath("/");

    return {
      success: true,
      attachment: {
        ...att,
        url: `/api/attachments/${att.id}`,
        thumbUrl: att.thumbnailPath ? `/api/attachments/${att.id}?thumb=1` : null,
      },
    };
  } catch (err: unknown) {
    console.error("Error linking attachment to task:", err);
    return { error: "Failed to link attachment to task." };
  }
}

export async function unlinkAttachmentFromTaskAction(
  taskId: string,
  attachmentId: string
): Promise<{ success?: boolean; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  try {
    await db
      .delete(taskAttachments)
      .where(
        and(
          eq(taskAttachments.taskId, taskId),
          eq(taskAttachments.attachmentId, attachmentId),
          eq(taskAttachments.userId, session.userId)
        )
      );

    revalidatePath("/");

    return { success: true };
  } catch (err: unknown) {
    console.error("Error unlinking attachment from task:", err);
    return { error: "Failed to unlink attachment." };
  }
}

export async function getUserAvailableTaskAttachmentsAction(
  taskId: string
): Promise<{ attachments?: AttachmentWithUrl[]; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  try {
    const linked = await db
      .select({ attachmentId: taskAttachments.attachmentId })
      .from(taskAttachments)
      .where(
        and(eq(taskAttachments.taskId, taskId), eq(taskAttachments.userId, session.userId))
      );

    const linkedIds = new Set(linked.map((r) => r.attachmentId));

    const allUserAttachments = await db
      .select()
      .from(attachments)
      .where(eq(attachments.userId, session.userId))
      .orderBy(desc(attachments.createdAt));

    const available = allUserAttachments
      .filter((att) => !linkedIds.has(att.id))
      .map((att) => ({
        ...att,
        url: `/api/attachments/${att.id}`,
        thumbUrl: att.thumbnailPath ? `/api/attachments/${att.id}?thumb=1` : null,
      }));

    return { attachments: available };
  } catch (err: unknown) {
    console.error("Error fetching available task attachments:", err);
    return { error: "Failed to fetch user attachments." };
  }
}
