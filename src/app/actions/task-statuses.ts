"use server";

import { db } from "@/db";
import {
  taskStatuses,
  tasks,
  TaskStatus,
  TaskStatusCategory,
} from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { getActiveWorkspaceContext } from "@/lib/workspace";
import { and, eq, asc, max, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { DEFAULT_STATUSES } from "@/lib/status-utils";

export async function getWorkspaceTaskStatusesAction(
  workspaceId?: string
): Promise<{ statuses?: TaskStatus[]; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  try {
    const { activeWorkspace } = await getActiveWorkspaceContext(session.userId);
    const targetWorkspaceId = workspaceId || activeWorkspace.id;

    let list = await db
      .select()
      .from(taskStatuses)
      .where(eq(taskStatuses.workspaceId, targetWorkspaceId))
      .orderBy(asc(taskStatuses.order), asc(taskStatuses.createdAt));

    if (list.length === 0) {
      const now = new Date();
      const insertPayloads = DEFAULT_STATUSES.map((s) => ({
        workspaceId: targetWorkspaceId,
        name: s.name,
        color: s.color,
        category: s.category,
        order: s.order,
        isDefault: s.isDefault,
        createdAt: now,
        updatedAt: now,
      }));

      list = await db.insert(taskStatuses).values(insertPayloads).returning();
    } else {
      // Ensure the three default statuses are marked isDefault: true
      const needsDefaultUpdate = list.some(
        (s) => !s.isDefault && ["To Do", "Doing", "Done"].includes(s.name)
      );
      if (needsDefaultUpdate) {
        await db
          .update(taskStatuses)
          .set({ isDefault: true })
          .where(
            and(
              eq(taskStatuses.workspaceId, targetWorkspaceId),
              inArray(taskStatuses.name, ["To Do", "Doing", "Done"])
            )
          );
        list = list.map((s) =>
          ["To Do", "Doing", "Done"].includes(s.name)
            ? { ...s, isDefault: true }
            : s
        );
      }
    }

    return { statuses: list };
  } catch (err: unknown) {
    console.error("Error fetching task statuses:", err);
    return { error: "Failed to fetch task statuses." };
  }
}

export async function createTaskStatusAction(data: {
  name: string;
  color?: string;
  category?: TaskStatusCategory;
}): Promise<{ status?: TaskStatus; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  const name = data.name.trim();
  if (!name) {
    return { error: "Status name cannot be empty." };
  }
  if (name.length > 50) {
    return { error: "Status name must be at most 50 characters." };
  }

  const validCategories: TaskStatusCategory[] = ["todo", "doing", "done"];
  const category: TaskStatusCategory =
    data.category && validCategories.includes(data.category)
      ? data.category
      : "doing";

  const validColors = [
    "slate",
    "amber",
    "emerald",
    "indigo",
    "violet",
    "rose",
    "sky",
    "orange",
  ];
  const color = data.color && validColors.includes(data.color) ? data.color : "slate";

  try {
    const { activeWorkspace } = await getActiveWorkspaceContext(session.userId);

    const [maxOrderRow] = await db
      .select({ maxOrder: max(taskStatuses.order) })
      .from(taskStatuses)
      .where(eq(taskStatuses.workspaceId, activeWorkspace.id));

    const nextOrder = (maxOrderRow?.maxOrder ?? -1) + 1;
    const now = new Date();

    const [newStatus] = await db
      .insert(taskStatuses)
      .values({
        workspaceId: activeWorkspace.id,
        name,
        color,
        category,
        order: nextOrder,
        isDefault: false,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    revalidatePath("/");
    revalidatePath("/kanban");
    return { status: newStatus };
  } catch (err: unknown) {
    console.error("Error creating task status:", err);
    return { error: "Failed to create task status." };
  }
}

export async function updateTaskStatusAction(
  statusId: string,
  data: {
    name?: string;
    color?: string;
    category?: TaskStatusCategory;
  }
): Promise<{ status?: TaskStatus; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  try {
    const { activeWorkspace } = await getActiveWorkspaceContext(session.userId);

    const [existing] = await db
      .select()
      .from(taskStatuses)
      .where(
        and(
          eq(taskStatuses.id, statusId),
          eq(taskStatuses.workspaceId, activeWorkspace.id)
        )
      );

    if (!existing) {
      return { error: "Status not found." };
    }

    const updateValues: Partial<typeof taskStatuses.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (data.name !== undefined) {
      const trimmed = data.name.trim();
      if (!trimmed) return { error: "Status name cannot be empty." };
      if (trimmed.length > 50) return { error: "Status name must be at most 50 characters." };
      updateValues.name = trimmed;
    }

    if (data.color !== undefined) {
      updateValues.color = data.color;
    }

    if (data.category !== undefined) {
      const validCategories: TaskStatusCategory[] = ["todo", "doing", "done"];
      if (!validCategories.includes(data.category)) {
        return { error: "Invalid category." };
      }
      updateValues.category = data.category;
    }

    const [updated] = await db
      .update(taskStatuses)
      .set(updateValues)
      .where(eq(taskStatuses.id, statusId))
      .returning();

    // If category changed, sync completed state of affected tasks
    if (data.category && data.category !== existing.category) {
      const isDone = data.category === "done";
      await db
        .update(tasks)
        .set({ completed: isDone, updatedAt: new Date() })
        .where(
          and(
            eq(tasks.statusId, statusId),
            eq(tasks.workspaceId, activeWorkspace.id)
          )
        );
    }

    revalidatePath("/");
    revalidatePath("/kanban");
    return { status: updated };
  } catch (err: unknown) {
    console.error("Error updating task status:", err);
    return { error: "Failed to update task status." };
  }
}

export async function deleteTaskStatusAction(
  statusId: string
): Promise<{ success?: boolean; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  try {
    const { activeWorkspace } = await getActiveWorkspaceContext(session.userId);

    const [status] = await db
      .select()
      .from(taskStatuses)
      .where(
        and(
          eq(taskStatuses.id, statusId),
          eq(taskStatuses.workspaceId, activeWorkspace.id)
        )
      );

    if (!status) {
      return { error: "Status not found." };
    }

    if (status.isDefault || ["To Do", "Doing", "Done"].includes(status.name)) {
      return { error: "Cannot delete default status." };
    }

    // Disassociate status from tasks (set status_id = null)
    await db
      .update(tasks)
      .set({ statusId: null, updatedAt: new Date() })
      .where(
        and(
          eq(tasks.statusId, statusId),
          eq(tasks.workspaceId, activeWorkspace.id)
        )
      );

    await db.delete(taskStatuses).where(eq(taskStatuses.id, statusId));

    revalidatePath("/");
    revalidatePath("/kanban");
    return { success: true };
  } catch (err: unknown) {
    console.error("Error deleting task status:", err);
    return { error: "Failed to delete task status." };
  }
}

export async function reorderTaskStatusesAction(
  orderedStatusIds: string[]
): Promise<{ success?: boolean; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  try {
    const { activeWorkspace } = await getActiveWorkspaceContext(session.userId);

    const updatePromises = orderedStatusIds.map((id, index) =>
      db
        .update(taskStatuses)
        .set({ order: index, updatedAt: new Date() })
        .where(
          and(
            eq(taskStatuses.id, id),
            eq(taskStatuses.workspaceId, activeWorkspace.id)
          )
        )
    );

    await Promise.all(updatePromises);

    revalidatePath("/kanban");
    return { success: true };
  } catch (err: unknown) {
    console.error("Error reordering task statuses:", err);
    return { error: "Failed to reorder task statuses." };
  }
}