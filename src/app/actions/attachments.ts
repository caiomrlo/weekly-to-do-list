"use server";

import { db } from "@/db";
import { attachments, tasks, Attachment } from "@/db/schema";
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

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

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
      .select()
      .from(attachments)
      .where(
        and(eq(attachments.taskId, taskId), eq(attachments.userId, session.userId))
      )
      .orderBy(desc(attachments.createdAt));

    const list: AttachmentWithUrl[] = rows.map((att) => ({
      ...att,
      url: `/api/attachments/${att.id}`,
      thumbUrl: att.thumbnailPath ? `/api/attachments/${att.id}?thumb=1` : null,
    }));

    return { attachments: list };
  } catch (err: unknown) {
    console.error("Error fetching task attachments:", err);
    return { error: "Failed to fetch task attachments." };
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
  const file = formData.get("file");

  if (!taskId || typeof taskId !== "string") {
    return { error: "Invalid task ID." };
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

  const [task] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, session.userId)))
    .limit(1);

  if (!task) {
    return { error: "Task not found or access denied." };
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
          taskId,
          userId: session.userId,
          fileName: file.name,
          filePath,
          thumbnailPath,
          contentType: file.type,
          fileSize: file.size,
        })
        .returning();

      revalidatePath("/");

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

    return { success: true };
  } catch (err: unknown) {
    console.error("Error deleting attachment:", err);
    return { error: "Failed to delete attachment." };
  }
}
