import { tool } from "ai";
import { z } from "zod";
import { db } from "@/db";
import { projects, taskStatuses } from "@/db/schema";
import { and, eq, asc } from "drizzle-orm";
import {
  createTaskInternal,
  updateTaskInternal,
  toggleTaskStatusInternal,
  deleteTaskInternalAction,
} from "@/lib/tasks/task-mutations";
import {
  getWeekTasksInternal,
  getKanbanTasksInternal,
} from "@/lib/tasks/task-queries";

export interface AgentToolsContext {
  userId: string;
  workspaceId: string;
}

export function createAgentTools({ userId, workspaceId }: AgentToolsContext) {
  return {
    listTasks: tool({
      description:
        "List tasks in the current workspace. Can filter by date range (startDate to endDate in YYYY-MM-DD), project ID, completion status, or backlog only.",
      inputSchema: z.object({
        startDate: z
          .string()
          .optional()
          .describe("Start date in YYYY-MM-DD format (inclusive)."),
        endDate: z
          .string()
          .optional()
          .describe("End date in YYYY-MM-DD format (inclusive)."),
        completed: z
          .boolean()
          .optional()
          .describe("Filter by completion status (true = completed, false = pending)."),
        projectId: z
          .string()
          .optional()
          .describe("Filter tasks assigned to a specific project ID."),
        backlogOnly: z
          .boolean()
          .optional()
          .describe("If true, list only unscheduled tasks with no date assigned."),
      }),
      execute: async ({ startDate, endDate, completed, projectId, backlogOnly }) => {
        try {
          let taskList;
          if (backlogOnly) {
            const allTasks = await getKanbanTasksInternal(userId, workspaceId);
            taskList = allTasks.filter((t) => !t.date);
          } else if (startDate && endDate) {
            taskList = await getWeekTasksInternal(
              userId,
              workspaceId,
              startDate,
              endDate
            );
          } else {
            taskList = await getKanbanTasksInternal(userId, workspaceId);
          }

          if (completed !== undefined) {
            taskList = taskList.filter((t) => t.completed === completed);
          }

          if (projectId) {
            taskList = taskList.filter((t) => t.projectId === projectId);
          }

          return {
            total: taskList.length,
            tasks: taskList.map((t) => ({
              id: t.id,
              title: t.title,
              date: t.date,
              time: t.time,
              duration: t.duration,
              completed: t.completed,
              statusName: t.status?.name || (t.completed ? "Done" : "To Do"),
              projectName: t.project?.name || null,
              projectId: t.projectId,
            })),
          };
        } catch (error) {
          console.error("Error executing listTasks tool:", error);
          return { error: "Failed to list tasks." };
        }
      },
    }),

    createTask: tool({
      description:
        "Create a single task in the active workspace. Pass date in YYYY-MM-DD format, or null/omit for backlog.",
      inputSchema: z.object({
        title: z.string().describe("The clear, descriptive title of the task."),
        date: z
          .string()
          .nullable()
          .optional()
          .describe("Target date in YYYY-MM-DD format, or null for unscheduled backlog."),
        time: z
          .string()
          .optional()
          .describe("Scheduled start time in 24h format (HH:mm), e.g. 09:30, 14:00."),
        duration: z
          .number()
          .nullable()
          .optional()
          .describe("Estimated duration in minutes (e.g. 30, 60, 90)."),
        projectId: z
          .string()
          .nullable()
          .optional()
          .describe("Project ID to associate this task with."),
        statusId: z
          .string()
          .nullable()
          .optional()
          .describe("Status ID for the task."),
      }),
      execute: async ({ title, date, time, duration, projectId, statusId }) => {
        try {
          const task = await createTaskInternal(
            {
              title,
              date: date || null,
              time: time || undefined,
              duration: duration || null,
              projectId: projectId || null,
              statusId: statusId || null,
              workspaceId,
            },
            userId
          );

          return {
            success: true,
            task: {
              id: task.id,
              title: task.title,
              date: task.date,
              time: task.time,
              duration: task.duration,
              statusName: task.status?.name || "To Do",
              projectName: task.project?.name || null,
            },
          };
        } catch (error) {
          console.error("Error executing createTask tool:", error);
          return {
            error: error instanceof Error ? error.message : "Failed to create task.",
          };
        }
      },
    }),

    createTasksBatch: tool({
      description:
        "Create multiple tasks in a single call. Use this when the user asks to plan a project or schedule multiple items at once.",
      inputSchema: z.object({
        tasks: z
          .array(
            z.object({
              title: z.string().describe("Task title."),
              date: z
                .string()
                .nullable()
                .optional()
                .describe("Date in YYYY-MM-DD format or null for backlog."),
              time: z
                .string()
                .optional()
                .describe("Time in HH:mm format."),
              duration: z
                .number()
                .nullable()
                .optional()
                .describe("Duration in minutes."),
              projectId: z
                .string()
                .nullable()
                .optional()
                .describe("Project ID."),
              statusId: z
                .string()
                .nullable()
                .optional()
                .describe("Status ID."),
            })
          )
          .describe("List of tasks to create."),
      }),
      execute: async ({ tasks: taskItems }) => {
        try {
          const createdList = [];
          for (const item of taskItems) {
            const task = await createTaskInternal(
              {
                title: item.title,
                date: item.date || null,
                time: item.time || undefined,
                duration: item.duration || null,
                projectId: item.projectId || null,
                statusId: item.statusId || null,
                workspaceId,
              },
              userId
            );
            createdList.push({
              id: task.id,
              title: task.title,
              date: task.date,
              time: task.time,
              duration: task.duration,
              statusName: task.status?.name || "To Do",
              projectName: task.project?.name || null,
            });
          }

          return {
            success: true,
            count: createdList.length,
            tasks: createdList,
          };
        } catch (error) {
          console.error("Error executing createTasksBatch tool:", error);
          return {
            error:
              error instanceof Error ? error.message : "Failed to create batch tasks.",
          };
        }
      },
    }),

    updateTask: tool({
      description:
        "Update an existing task's title, scheduled date, time, duration, completion status, or project.",
      inputSchema: z.object({
        taskId: z.string().describe("The ID of the task to update."),
        title: z.string().optional().describe("New title for the task."),
        date: z
          .string()
          .nullable()
          .optional()
          .describe("New date in YYYY-MM-DD format, or null to move to backlog."),
        time: z
          .string()
          .nullable()
          .optional()
          .describe("New time in HH:mm format, or null to clear."),
        duration: z
          .number()
          .nullable()
          .optional()
          .describe("New duration in minutes, or null to clear."),
        completed: z
          .boolean()
          .optional()
          .describe("Mark task as completed (true) or pending (false)."),
        statusId: z
          .string()
          .nullable()
          .optional()
          .describe("New status ID for the task."),
        projectId: z
          .string()
          .nullable()
          .optional()
          .describe("Project ID to associate or null to remove."),
      }),
      execute: async ({
        taskId,
        title,
        date,
        time,
        duration,
        completed,
        statusId,
        projectId,
      }) => {
        try {
          if (completed !== undefined) {
            await toggleTaskStatusInternal(taskId, completed, userId, workspaceId);
          }

          const hasDataUpdates =
            title !== undefined ||
            date !== undefined ||
            time !== undefined ||
            duration !== undefined ||
            statusId !== undefined ||
            projectId !== undefined;

          let updatedTask;
          if (hasDataUpdates) {
            updatedTask = await updateTaskInternal(
              taskId,
              {
                title,
                date,
                time,
                duration,
                statusId,
                projectId,
              },
              userId
            );
          }

          return {
            success: true,
            taskId,
            title: updatedTask?.title,
            completed: completed !== undefined ? completed : updatedTask?.completed,
            date: updatedTask?.date,
            statusName: updatedTask?.status?.name,
          };
        } catch (error) {
          console.error("Error executing updateTask tool:", error);
          return {
            error: error instanceof Error ? error.message : "Failed to update task.",
          };
        }
      },
    }),

    deleteTask: tool({
      description: "Permanently delete a task by ID.",
      inputSchema: z.object({
        taskId: z.string().describe("The ID of the task to delete."),
      }),
      execute: async ({ taskId }) => {
        try {
          await deleteTaskInternalAction(taskId, "this", userId);
          return { success: true, deletedTaskId: taskId };
        } catch (error) {
          console.error("Error executing deleteTask tool:", error);
          return {
            error: error instanceof Error ? error.message : "Failed to delete task.",
          };
        }
      },
    }),

    listProjects: tool({
      description: "List all existing projects in the active workspace.",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const list = await db
            .select()
            .from(projects)
            .where(
              and(
                eq(projects.workspaceId, workspaceId),
                eq(projects.userId, userId)
              )
            )
            .orderBy(asc(projects.name));

          return {
            projects: list.map((p) => ({
              id: p.id,
              name: p.name,
              color: p.color,
            })),
          };
        } catch (error) {
          console.error("Error executing listProjects tool:", error);
          return { error: "Failed to list projects." };
        }
      },
    }),

    createProject: tool({
      description: "Create a new project in the active workspace.",
      inputSchema: z.object({
        name: z.string().describe("Project name (e.g. Website Launch, Redesign)."),
        color: z
          .string()
          .optional()
          .describe("Project color name: indigo, violet, emerald, amber, rose, sky, orange, slate."),
      }),
      execute: async ({ name, color }) => {
        try {
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
          const resolvedColor =
            color && validColors.includes(color) ? color : "amber";

          const now = new Date();
          const [newProj] = await db
            .insert(projects)
            .values({
              workspaceId,
              userId,
              name: name.trim(),
              color: resolvedColor,
              createdAt: now,
              updatedAt: now,
            })
            .returning();

          return {
            success: true,
            project: {
              id: newProj.id,
              name: newProj.name,
              color: newProj.color,
            },
          };
        } catch (error) {
          console.error("Error executing createProject tool:", error);
          return {
            error: error instanceof Error ? error.message : "Failed to create project.",
          };
        }
      },
    }),

    listStatuses: tool({
      description: "List available task statuses in this workspace (e.g. To Do, Doing, Done).",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const statuses = await db
            .select()
            .from(taskStatuses)
            .where(eq(taskStatuses.workspaceId, workspaceId))
            .orderBy(asc(taskStatuses.order));

          return {
            statuses: statuses.map((s) => ({
              id: s.id,
              name: s.name,
              category: s.category,
              isDefault: s.isDefault,
            })),
          };
        } catch (error) {
          console.error("Error executing listStatuses tool:", error);
          return { error: "Failed to list statuses." };
        }
      },
    }),
  };
}
