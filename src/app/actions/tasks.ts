"use server";

import { TaskWithTag, TaskAssigneeUser, RecurrenceFrequency } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { getActiveWorkspaceContext } from "@/lib/workspace";
import { revalidatePath } from "next/cache";
import {
  batchFetchTaskAssignees,
  updateTaskAssigneesInternal,
} from "@/lib/tasks/task-assignees";
import {
  getWeekTasksInternal,
  getKanbanTasksInternal,
  getSubtasksInternal,
  getTaskByIdInternal,
} from "@/lib/tasks/task-queries";
import {
  createTaskInternal,
  toggleTaskStatusInternal,
  updateTaskInternal,
  deleteTaskInternalAction,
} from "@/lib/tasks/task-mutations";
import {
  moveOrReorderTasksInternal,
  moveTaskKanbanInternal,
} from "@/lib/tasks/task-reorder";
import { updateTaskRecurrenceInternal } from "@/lib/tasks/task-recurrence";

export { batchFetchTaskAssignees };

export async function getWeekTasksAction(
  startDate: string,
  endDate: string
): Promise<{ tasks?: TaskWithTag[]; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  try {
    const { activeWorkspace } = await getActiveWorkspaceContext(session.userId);
    const tasks = await getWeekTasksInternal(
      session.userId,
      activeWorkspace.id,
      startDate,
      endDate
    );
    return { tasks };
  } catch (err: unknown) {
    console.error("Error fetching week tasks:", err);
    return { error: "Failed to fetch tasks." };
  }
}

export async function getSubtasksAction(
  parentTaskId: string
): Promise<{ subtasks?: TaskWithTag[]; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  try {
    const subtasks = await getSubtasksInternal(session.userId, parentTaskId);
    return { subtasks };
  } catch (err: unknown) {
    console.error("Error fetching subtasks:", err);
    return { error: "Failed to fetch subtasks." };
  }
}

export async function getTaskByIdAction(
  taskId: string
): Promise<{ task?: TaskWithTag; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  try {
    const task = await getTaskByIdInternal(taskId, session.userId);
    return { task };
  } catch (err: unknown) {
    console.error("Error fetching task by ID:", err);
    if (err instanceof Error && err.message === "Task not found.") {
      return { error: "Task not found." };
    }
    return { error: "Failed to load task." };
  }
}

export async function createTaskAction(data: {
  title: string;
  date?: string | null;
  time?: string;
  duration?: number | null;
  tagId?: string | null;
  projectId?: string | null;
  statusId?: string | null;
  parentId?: string | null;
  workspaceId?: string;
  assigneeIds?: string[];
}): Promise<{ task?: TaskWithTag; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  try {
    const task = await createTaskInternal(data, session.userId);
    revalidatePath("/");
    revalidatePath("/kanban");
    return { task };
  } catch (err: unknown) {
    console.error("Error creating task:", err);
    return { error: err instanceof Error ? err.message : "Failed to create task." };
  }
}

export async function toggleTaskStatusAction(
  taskId: string,
  completed: boolean
): Promise<{ success?: boolean; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  try {
    const { activeWorkspace } = await getActiveWorkspaceContext(session.userId);
    await toggleTaskStatusInternal(taskId, completed, session.userId, activeWorkspace.id);
    revalidatePath("/");
    revalidatePath("/kanban");
    return { success: true };
  } catch (err: unknown) {
    console.error("Error updating status:", err);
    return { error: "Failed to update status." };
  }
}

export async function updateTaskAction(
  taskId: string,
  data: {
    title?: string;
    content?: string;
    date?: string | null;
    time?: string | null;
    duration?: number | null;
    tagId?: string | null;
    projectId?: string | null;
    statusId?: string | null;
    editScope?: "this" | "future";
    assigneeIds?: string[];
  }
): Promise<{ task?: TaskWithTag; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  try {
    const task = await updateTaskInternal(taskId, data, session.userId);
    revalidatePath("/");
    revalidatePath("/kanban");
    return { task };
  } catch (err: unknown) {
    console.error("Error updating task:", err);
    if (err instanceof Error && err.message === "Task not found.") {
      return { error: "Task not found." };
    }
    return { error: "Failed to save task changes." };
  }
}

export async function updateTaskRecurrenceAction(params: {
  taskId: string;
  frequency: RecurrenceFrequency | "none";
  interval?: number;
  daysOfWeek?: number[];
  dayOfMonth?: number;
  monthOfYear?: number;
  endDate?: string | null;
  currentWeekRange?: { startDate: string; endDate: string };
}): Promise<{
  task?: TaskWithTag;
  newTasks?: TaskWithTag[];
  deletedTaskIds?: string[];
  error?: string;
}> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  try {
    const res = await updateTaskRecurrenceInternal(params, session.userId);
    const updatedTask = await getTaskByIdInternal(res.targetTaskId, session.userId);
    revalidatePath("/");
    return {
      task: updatedTask,
      newTasks: res.newTasks,
      deletedTaskIds: res.deletedTaskIds,
    };
  } catch (err: unknown) {
    console.error("Error updating task recurrence:", err);
    if (err instanceof Error && err.message === "Task not found.") {
      return { error: "Task not found." };
    }
    return { error: "Failed to update recurrence." };
  }
}

export async function deleteTaskAction(
  taskId: string,
  deleteScope: "this" | "future" | "all" = "this"
): Promise<{ success?: boolean; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  try {
    await deleteTaskInternalAction(taskId, deleteScope, session.userId);
    revalidatePath("/");
    return { success: true };
  } catch (err: unknown) {
    console.error("Error deleting task:", err);
    if (err instanceof Error && err.message === "Task not found.") {
      return { error: "Task not found." };
    }
    return { error: "Failed to delete task." };
  }
}

export async function moveOrReorderTasksAction(params: {
  taskId: string;
  targetDate?: string | null;
  targetParentId: string | null;
  targetOrderedIds: string[];
  sourceOrderedIds?: string[];
  originalDate?: string | null;
  moveSameDaySubtasks?: boolean;
}): Promise<{ success?: boolean; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  try {
    await moveOrReorderTasksInternal(params, session.userId);
    revalidatePath("/");
    return { success: true };
  } catch (err: unknown) {
    console.error("Error moving/reordering tasks:", err);
    return { error: err instanceof Error ? err.message : "Failed to save task order." };
  }
}

export async function getKanbanTasksAction(): Promise<{
  tasks?: TaskWithTag[];
  error?: string;
}> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  try {
    const { activeWorkspace } = await getActiveWorkspaceContext(session.userId);
    const tasks = await getKanbanTasksInternal(session.userId, activeWorkspace.id);
    return { tasks };
  } catch (err: unknown) {
    console.error("Error fetching kanban tasks:", err);
    return { error: "Failed to fetch kanban tasks." };
  }
}

export async function moveTaskKanbanAction(params: {
  taskId: string;
  targetStatusId: string;
  targetOrderedIds: string[];
}): Promise<{ success?: boolean; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  try {
    const { activeWorkspace } = await getActiveWorkspaceContext(session.userId);
    await moveTaskKanbanInternal(params, session.userId, activeWorkspace.id);
    revalidatePath("/");
    revalidatePath("/kanban");
    return { success: true };
  } catch (err: unknown) {
    console.error("Error moving task in kanban:", err);
    if (
      err instanceof Error &&
      (err.message === "Task not found." || err.message === "Target status not found.")
    ) {
      return { error: err.message };
    }
    return { error: "Failed to move task." };
  }
}

export async function updateTaskAssigneesAction(
  taskId: string,
  userIds: string[]
): Promise<{ assignees?: TaskAssigneeUser[]; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  try {
    const assignees = await updateTaskAssigneesInternal(taskId, userIds, session.userId);
    revalidatePath("/");
    revalidatePath("/kanban");
    return { assignees };
  } catch (err: unknown) {
    console.error("Error updating task assignees:", err);
    return {
      error:
        err instanceof Error ? err.message : "Failed to update task assignees.",
    };
  }
}
