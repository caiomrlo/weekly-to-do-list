import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import {
  getWorkspaceTaskStatusesAction,
  createTaskStatusAction,
  updateTaskStatusAction,
  deleteTaskStatusAction,
  reorderTaskStatusesAction,
} from "@/app/actions/task-statuses";
import {
  createTaskAction,
  getKanbanTasksAction,
  moveTaskKanbanAction,
  toggleTaskStatusAction,
} from "@/app/actions/tasks";
import { db, cleanupTestUser } from "../setup/test-db";
import {
  createTestUser,
  loginAsTestUser,
  logoutTestUser,
  TestUserData,
} from "../setup/auth-helper";
import { taskStatuses, tasks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

describe("Integration: Task Statuses & Kanban Actions", () => {
  let userA: TestUserData;
  let userB: TestUserData;

  beforeEach(async () => {
    vi.clearAllMocks();
    logoutTestUser();
  });

  afterAll(async () => {
    if (userA?.id) await cleanupTestUser(userA.id);
    if (userB?.id) await cleanupTestUser(userB.id);
  });

  describe("Authentication Guard", () => {
    it("should reject all task status actions when not authenticated", async () => {
      const getRes = await getWorkspaceTaskStatusesAction();
      expect(getRes.error).toBe("Not authenticated.");

      const createRes = await createTaskStatusAction({ name: "In Review" });
      expect(createRes.error).toBe("Not authenticated.");

      const updateRes = await updateTaskStatusAction("some-id", { name: "Updated" });
      expect(updateRes.error).toBe("Not authenticated.");

      const deleteRes = await deleteTaskStatusAction("some-id");
      expect(deleteRes.error).toBe("Not authenticated.");

      const reorderRes = await reorderTaskStatusesAction([]);
      expect(reorderRes.error).toBe("Not authenticated.");

      const kanbanTasksRes = await getKanbanTasksAction();
      expect(kanbanTasksRes.error).toBe("Not authenticated.");

      const moveRes = await moveTaskKanbanAction({
        taskId: "some-id",
        targetStatusId: "some-status-id",
        targetOrderedIds: ["some-id"],
      });
      expect(moveRes.error).toBe("Not authenticated.");
    });
  });

  describe("getWorkspaceTaskStatusesAction & Auto-provisioning", () => {
    it("should auto-provision the 3 default statuses for a new workspace", async () => {
      userA = await createTestUser();
      await loginAsTestUser(userA);

      const res = await getWorkspaceTaskStatusesAction();
      expect(res.error).toBeUndefined();
      expect(res.statuses).toBeDefined();
      expect(res.statuses).toHaveLength(3);

      const [todo, doing, done] = res.statuses!;

      expect(todo.name).toBe("To Do");
      expect(todo.category).toBe("todo");
      expect(todo.color).toBe("slate");
      expect(todo.order).toBe(0);
      expect(todo.isDefault).toBe(true);

      expect(doing.name).toBe("Doing");
      expect(doing.category).toBe("doing");
      expect(doing.color).toBe("amber");
      expect(doing.order).toBe(1);
      expect(doing.isDefault).toBe(true);

      expect(done.name).toBe("Done");
      expect(done.category).toBe("done");
      expect(done.color).toBe("emerald");
      expect(done.order).toBe(2);
      expect(done.isDefault).toBe(true);
    });

    it("should not create duplicate statuses on subsequent calls", async () => {
      await loginAsTestUser(userA);

      const firstCall = await getWorkspaceTaskStatusesAction();
      const secondCall = await getWorkspaceTaskStatusesAction();

      expect(firstCall.statuses).toHaveLength(3);
      expect(secondCall.statuses).toHaveLength(3);
      expect(firstCall.statuses![0].id).toBe(secondCall.statuses![0].id);
    });

    it("should isolate workspace task statuses between different users", async () => {
      userB = await createTestUser();
      await loginAsTestUser(userB);

      const resB = await getWorkspaceTaskStatusesAction();
      expect(resB.statuses).toHaveLength(3);

      // Verify statuses in DB belong to distinct workspaces
      await loginAsTestUser(userA);
      const resA = await getWorkspaceTaskStatusesAction();

      const userAStatusIds = resA.statuses!.map((s) => s.id);
      const userBStatusIds = resB.statuses!.map((s) => s.id);

      for (const id of userAStatusIds) {
        expect(userBStatusIds).not.toContain(id);
      }
    });
  });

  describe("createTaskStatusAction", () => {
    it("should reject empty status name", async () => {
      await loginAsTestUser(userA);

      const res = await createTaskStatusAction({ name: "   " });
      expect(res.error).toBe("Status name cannot be empty.");
    });

    it("should reject status name exceeding 50 characters", async () => {
      await loginAsTestUser(userA);

      const res = await createTaskStatusAction({ name: "S".repeat(51) });
      expect(res.error).toBe("Status name must be at most 50 characters.");
    });

    it("should create a custom status column defaulting to category doing", async () => {
      await loginAsTestUser(userA);

      const res = await createTaskStatusAction({
        name: "QA Review",
        color: "violet",
      });

      expect(res.error).toBeUndefined();
      expect(res.status).toBeDefined();
      expect(res.status?.name).toBe("QA Review");
      expect(res.status?.color).toBe("violet");
      expect(res.status?.category).toBe("doing");
      expect(res.status?.isDefault).toBe(false);
      expect(res.status?.order).toBe(3); // after 0, 1, 2

      expect(revalidatePath).toHaveBeenCalledWith("/kanban");
      expect(revalidatePath).toHaveBeenCalledWith("/");
    });

    it("should fall back to slate color if invalid color is provided", async () => {
      await loginAsTestUser(userA);

      const res = await createTaskStatusAction({
        name: "Testing Fallback",
        color: "non-existent-color",
      });

      expect(res.error).toBeUndefined();
      expect(res.status?.color).toBe("slate");
    });
  });

  describe("updateTaskStatusAction", () => {
    it("should allow editing status name and color", async () => {
      await loginAsTestUser(userA);

      const created = await createTaskStatusAction({ name: "Backlog", color: "sky" });
      const statusId = created.status!.id;

      const updated = await updateTaskStatusAction(statusId, {
        name: "Sprint Backlog",
        color: "indigo",
      });

      expect(updated.error).toBeUndefined();
      expect(updated.status?.name).toBe("Sprint Backlog");
      expect(updated.status?.color).toBe("indigo");
    });

    it("should reject invalid names during update", async () => {
      await loginAsTestUser(userA);

      const statuses = await getWorkspaceTaskStatusesAction();
      const firstId = statuses.statuses![0].id;

      const emptyRes = await updateTaskStatusAction(firstId, { name: "   " });
      expect(emptyRes.error).toBe("Status name cannot be empty.");

      const tooLongRes = await updateTaskStatusAction(firstId, { name: "A".repeat(51) });
      expect(tooLongRes.error).toBe("Status name must be at most 50 characters.");
    });

    it("should reject updating a status belonging to another workspace", async () => {
      await loginAsTestUser(userA);
      const userAStatuses = await getWorkspaceTaskStatusesAction();
      const targetId = userAStatuses.statuses![0].id;

      await loginAsTestUser(userB);
      const res = await updateTaskStatusAction(targetId, { name: "Hacked" });
      expect(res.error).toBe("Status not found.");
    });

    it("should sync task completion when status category changes", async () => {
      await loginAsTestUser(userA);

      // Create a custom status
      const customStatus = await createTaskStatusAction({ name: "Testing Done Category", color: "rose" });
      const statusId = customStatus.status!.id;

      // Create a task assigned to this status
      const taskRes = await createTaskAction({
        title: "Task in custom status",
        statusId,
      });
      expect(taskRes.task?.completed).toBe(false);

      // Update status category to "done"
      await updateTaskStatusAction(statusId, { category: "done" });

      // Verify task completion was synced to true
      const [updatedTask] = await db.select().from(tasks).where(eq(tasks.id, taskRes.task!.id));
      expect(updatedTask.completed).toBe(true);
    });
  });

  describe("deleteTaskStatusAction & Protection Rules", () => {
    it("should strictly prohibit deleting default statuses (To Do, Doing, Done)", async () => {
      await loginAsTestUser(userA);
      const { statuses } = await getWorkspaceTaskStatusesAction();

      const todo = statuses!.find((s) => s.name === "To Do")!;
      const doing = statuses!.find((s) => s.name === "Doing")!;
      const done = statuses!.find((s) => s.name === "Done")!;

      const deleteTodo = await deleteTaskStatusAction(todo.id);
      expect(deleteTodo.error).toBe("Cannot delete default status.");

      const deleteDoing = await deleteTaskStatusAction(doing.id);
      expect(deleteDoing.error).toBe("Cannot delete default status.");

      const deleteDone = await deleteTaskStatusAction(done.id);
      expect(deleteDone.error).toBe("Cannot delete default status.");
    });

    it("should reject deleting a status belonging to another workspace", async () => {
      await loginAsTestUser(userA);
      const created = await createTaskStatusAction({ name: "User A Col" });

      await loginAsTestUser(userB);
      const res = await deleteTaskStatusAction(created.status!.id);
      expect(res.error).toBe("Status not found.");
    });

    it("should delete a custom status and dissociate (nullify) statusId on affected tasks", async () => {
      await loginAsTestUser(userA);

      // Create custom status
      const created = await createTaskStatusAction({ name: "To Be Deleted" });
      const statusId = created.status!.id;

      // Create task attached to this status
      const taskRes = await createTaskAction({
        title: "Task under soon-to-be-deleted status",
        statusId,
      });
      const taskId = taskRes.task!.id;

      // Verify task is linked to statusId
      const [initialTask] = await db.select().from(tasks).where(eq(tasks.id, taskId));
      expect(initialTask.statusId).toBe(statusId);

      // Delete the status
      const deleteRes = await deleteTaskStatusAction(statusId);
      expect(deleteRes.error).toBeUndefined();
      expect(deleteRes.success).toBe(true);

      // Verify task was NOT deleted, but its statusId was set to null
      const [remainingTask] = await db.select().from(tasks).where(eq(tasks.id, taskId));
      expect(remainingTask).toBeDefined();
      expect(remainingTask.statusId).toBeNull();
      expect(remainingTask.title).toBe("Task under soon-to-be-deleted status");

      // Verify status itself is removed from DB
      const [statusRow] = await db.select().from(taskStatuses).where(eq(taskStatuses.id, statusId));
      expect(statusRow).toBeUndefined();
    });
  });

  describe("reorderTaskStatusesAction", () => {
    it("should persist new ordering for workspace task statuses", async () => {
      await loginAsTestUser(userA);
      const { statuses } = await getWorkspaceTaskStatusesAction();
      expect(statuses).toBeDefined();

      const allIds = statuses!.map((s) => s.id);
      const reversedIds = [...allIds].reverse();

      const reorderRes = await reorderTaskStatusesAction(reversedIds);
      expect(reorderRes.error).toBeUndefined();
      expect(reorderRes.success).toBe(true);

      const refreshed = await getWorkspaceTaskStatusesAction();
      const idsInOrder = refreshed.statuses!.map((s) => s.id);
      expect(idsInOrder).toEqual(reversedIds);
    });
  });

  describe("Kanban Task Operations & State Synchronization", () => {
    it("should retrieve tasks grouped with their status details via getKanbanTasksAction", async () => {
      await loginAsTestUser(userA);
      const { statuses } = await getWorkspaceTaskStatusesAction();
      const doingStatus = statuses!.find((s) => s.name === "Doing")!;

      await createTaskAction({
        title: "Active Kanban Task",
        statusId: doingStatus.id,
      });

      const res = await getKanbanTasksAction();
      expect(res.error).toBeUndefined();
      expect(res.tasks).toBeDefined();

      const activeTask = res.tasks!.find((t) => t.title === "Active Kanban Task");
      expect(activeTask).toBeDefined();
      expect(activeTask?.statusId).toBe(doingStatus.id);
      expect(activeTask?.status?.name).toBe("Doing");
    });

    it("should automatically set completed = true when moving to a done column", async () => {
      await loginAsTestUser(userA);
      const { statuses } = await getWorkspaceTaskStatusesAction();
      const todoStatus = statuses!.find((s) => s.name === "To Do")!;
      const doneStatus = statuses!.find((s) => s.name === "Done")!;

      const taskRes = await createTaskAction({
        title: "Moving to Done",
        statusId: todoStatus.id,
      });
      const taskId = taskRes.task!.id;
      expect(taskRes.task?.completed).toBe(false);

      // Move task to Done status
      const moveRes = await moveTaskKanbanAction({
        taskId,
        targetStatusId: doneStatus.id,
        targetOrderedIds: [taskId],
      });
      expect(moveRes.error).toBeUndefined();
      expect(moveRes.success).toBe(true);

      // Verify task in DB is now marked completed: true
      const [updated] = await db.select().from(tasks).where(eq(tasks.id, taskId));
      expect(updated.statusId).toBe(doneStatus.id);
      expect(updated.completed).toBe(true);
    });

    it("should automatically set completed = false when moving back to a todo or doing column", async () => {
      await loginAsTestUser(userA);
      const { statuses } = await getWorkspaceTaskStatusesAction();
      const doingStatus = statuses!.find((s) => s.name === "Doing")!;
      const doneStatus = statuses!.find((s) => s.name === "Done")!;

      const taskRes = await createTaskAction({
        title: "Reopening Task",
        statusId: doneStatus.id,
      });
      const taskId = taskRes.task!.id;

      // Mark completed
      await toggleTaskStatusAction(taskId, true);

      // Move to Doing status
      const moveRes = await moveTaskKanbanAction({
        taskId,
        targetStatusId: doingStatus.id,
        targetOrderedIds: [taskId],
      });
      expect(moveRes.error).toBeUndefined();

      // Verify task is un-completed
      const [updated] = await db.select().from(tasks).where(eq(tasks.id, taskId));
      expect(updated.statusId).toBe(doingStatus.id);
      expect(updated.completed).toBe(false);
    });

    it("should sync statusId when using toggleTaskStatusAction", async () => {
      await loginAsTestUser(userA);
      const { statuses } = await getWorkspaceTaskStatusesAction();
      const todoStatus = statuses!.find((s) => s.name === "To Do")!;
      const doneStatus = statuses!.find((s) => s.name === "Done")!;

      const taskRes = await createTaskAction({
        title: "Toggle Sync Task",
        statusId: todoStatus.id,
      });
      const taskId = taskRes.task!.id;

      // Toggle to completed
      await toggleTaskStatusAction(taskId, true);
      const [completedTask] = await db.select().from(tasks).where(eq(tasks.id, taskId));
      expect(completedTask.completed).toBe(true);
      expect(completedTask.statusId).toBe(doneStatus.id);

      // Toggle to incomplete
      await toggleTaskStatusAction(taskId, false);
      const [incompletedTask] = await db.select().from(tasks).where(eq(tasks.id, taskId));
      expect(incompletedTask.completed).toBe(false);
      expect(incompletedTask.statusId).toBe(todoStatus.id);
    });
  });
});
