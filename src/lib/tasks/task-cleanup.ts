import { db } from "@/db";
import {
  tasks,
  attachments,
  taskAttachments,
  docAttachments,
} from "@/db/schema";
import { and, eq, inArray, notInArray } from "drizzle-orm";
import { deleteManyFromR2 } from "@/lib/r2";

export async function deleteTasksInternal(taskIds: string[], userId: string): Promise<void> {
  if (taskIds.length === 0) return;

  const childTasks = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(inArray(tasks.parentId, taskIds), eq(tasks.userId, userId)));
  const allIdsToDelete = Array.from(new Set([...taskIds, ...childTasks.map((t) => t.id)]));

  const taskAttachmentRows = await db
    .select({
      id: attachments.id,
      filePath: attachments.filePath,
      thumbnailPath: attachments.thumbnailPath,
    })
    .from(taskAttachments)
    .innerJoin(attachments, eq(taskAttachments.attachmentId, attachments.id))
    .where(
      and(
        inArray(taskAttachments.taskId, allIdsToDelete),
        eq(taskAttachments.userId, userId)
      )
    );

  if (taskAttachmentRows.length > 0) {
    const candidateIds = taskAttachmentRows.map((a) => a.id);

    const [linkedToOtherTasks, linkedToDocs] = await Promise.all([
      db
        .select({ attachmentId: taskAttachments.attachmentId })
        .from(taskAttachments)
        .where(
          and(
            inArray(taskAttachments.attachmentId, candidateIds),
            notInArray(taskAttachments.taskId, allIdsToDelete),
            eq(taskAttachments.userId, userId)
          )
        ),
      db
        .select({ attachmentId: docAttachments.attachmentId })
        .from(docAttachments)
        .where(
          and(
            inArray(docAttachments.attachmentId, candidateIds),
            eq(docAttachments.userId, userId)
          )
        ),
    ]);

    const otherTaskLinkedSet = new Set(linkedToOtherTasks.map((r) => r.attachmentId));
    const docLinkedSet = new Set(linkedToDocs.map((r) => r.attachmentId));

    const attachmentsToDelete = taskAttachmentRows.filter(
      (a) => !otherTaskLinkedSet.has(a.id) && !docLinkedSet.has(a.id)
    );

    if (attachmentsToDelete.length > 0) {
      const keysToDelete = attachmentsToDelete
        .flatMap((a) => [a.filePath, a.thumbnailPath])
        .filter((k): k is string => Boolean(k));

      await deleteManyFromR2(keysToDelete).catch((r2Err) =>
        console.error("Warning: Failed to delete R2 files during deleteTask:", r2Err)
      );

      await db.delete(attachments).where(
        and(
          inArray(
            attachments.id,
            attachmentsToDelete.map((a) => a.id)
          ),
          eq(attachments.userId, userId)
        )
      );
    }
  }

  await db
    .delete(tasks)
    .where(and(inArray(tasks.id, allIdsToDelete), eq(tasks.userId, userId)));
}
