import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import {
  createTaskAction,
  getWeekTasksAction,
  getTaskByIdAction,
  getSubtasksAction,
  updateTaskAction,
  toggleTaskStatusAction,
  deleteTaskAction,
  moveOrReorderTasksAction,
} from "@/app/actions/tasks";
import { createProjectAction } from "@/app/actions/projects";
import { createTagAction } from "@/app/actions/tags";
import { db, cleanupTestUser } from "../setup/test-db";
import {
  createTestUser,
  loginAsTestUser,
  logoutTestUser,
  TestUserData,
} from "../setup/auth-helper";
import { tasks } from "@/db/schema";
import { eq } from "drizzle-orm";

describe("Integration: Tasks Actions", () => {
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
    it("should reject all task operations when not logged in", async () => {
      const getWeek = await getWeekTasksAction("2026-09-01", "2026-09-07");
      expect(getWeek.error).toBe("Not authenticated.");

      const create = await createTaskAction({ title: "No auth task" });
      expect(create.error).toBe("Not authenticated.");

      const update = await updateTaskAction("random-id", { title: "Title" });
      expect(update.error).toBe("Not authenticated.");

      const toggle = await toggleTaskStatusAction("random-id", true);
      expect(toggle.error).toBe("Not authenticated.");

      const del = await deleteTaskAction("random-id");
      expect(del.error).toBe("Not authenticated.");

      const move = await moveOrReorderTasksAction({
        taskId: "random-id",
        targetParentId: null,
        targetOrderedIds: [],
      });
      expect(move.error).toBe("Not authenticated.");
    });
  });

  describe("createTaskAction", () => {
    it("should reject empty task title", async () => {
      userA = await createTestUser();
      await loginAsTestUser(userA);

      const res = await createTaskAction({ title: "   " });
      expect(res.error).toBe("Task title cannot be empty.");
    });

    it("should create scheduled and unscheduled tasks with correct order", async () => {
      userA = await createTestUser();
      await loginAsTestUser(userA);

      // Create first scheduled task on 2026-09-15
      const res1 = await createTaskAction({
        title: "Scheduled Task 1",
        date: "2026-09-15",
        time: "10:00",
        duration: 45,
      });

      expect(res1.error).toBeUndefined();
      expect(res1.task?.order).toBe(0);
      expect(res1.task?.date).toBe("2026-09-15");
      expect(res1.task?.time).toBe("10:00");
      expect(res1.task?.duration).toBe(45);

      // Create second scheduled task on same day -> order should be 1
      const res2 = await createTaskAction({
        title: "Scheduled Task 2",
        date: "2026-09-15",
      });
      expect(res2.error).toBeUndefined();
      expect(res2.task?.order).toBe(1);

      // Create unscheduled task (date: null) -> order should be 0
      const res3 = await createTaskAction({
        title: "Backlog Task 1",
        date: null,
      });
      expect(res3.error).toBeUndefined();
      expect(res3.task?.date).toBeNull();
      expect(res3.task?.order).toBe(0);
    });

    it("should associate task with project and tag correctly", async () => {
      userA = await createTestUser();
      await loginAsTestUser(userA);

      const projRes = await createProjectAction({ name: "Core App", color: "indigo" });
      const tagRes = await createTagAction({ name: "Feature", color: "emerald" });

      const taskRes = await createTaskAction({
        title: "Implement feature",
        projectId: projRes.project!.id,
        tagId: tagRes.tag!.id,
      });

      expect(taskRes.error).toBeUndefined();
      expect(taskRes.task?.project?.name).toBe("Core App");
      expect(taskRes.task?.tag?.name).toBe("Feature");
    });

    it("should create a task with description", async () => {
      userA = await createTestUser();
      await loginAsTestUser(userA);

      const res = await createTaskAction({
        title: "Task with description",
        description: "This is a detailed description of the task.",
      });

      expect(res.error).toBeUndefined();
      expect(res.task?.content).toBe("This is a detailed description of the task.");

      const [dbRow] = await db
        .select()
        .from(tasks)
        .where(eq(tasks.id, res.task!.id));
      expect(dbRow.content).toBe("This is a detailed description of the task.");
    });
  });

  describe("Subtasks & Hierarchy Constraint", () => {
    it("should create 1-level subtask and reject 2nd level nesting", async () => {
      userA = await createTestUser();
      await loginAsTestUser(userA);

      // Create parent task
      const parent = await createTaskAction({
        title: "Parent Project Task",
        date: "2026-09-15",
      });
      const parentId = parent.task!.id;

      // Create valid 1st level subtask
      const subtask1 = await createTaskAction({
        title: "Subtask Step 1",
        parentId,
      });
      expect(subtask1.error).toBeUndefined();
      expect(subtask1.task?.parent?.id).toBe(parentId);

      // Attempt to create a subtask of a subtask (2nd level nesting)
      const subtask2 = await createTaskAction({
        title: "Illegal Sub-subtask",
        parentId: subtask1.task!.id,
      });
      expect(subtask2.error).toBe(
        "Cannot create a subtask of a subtask (maximum 1 level of nesting allowed)."
      );
    });

    it("should retrieve subtasks for a parent task via getSubtasksAction", async () => {
      userA = await createTestUser();
      await loginAsTestUser(userA);

      const parent = await createTaskAction({ title: "Master Task" });
      const parentId = parent.task!.id;

      await createTaskAction({ title: "Child 1", parentId });
      await createTaskAction({ title: "Child 2", parentId });

      const subtasksRes = await getSubtasksAction(parentId);
      expect(subtasksRes.error).toBeUndefined();
      expect(subtasksRes.subtasks?.length).toBe(2);
      expect(subtasksRes.subtasks?.[0].title).toBe("Child 1");
      expect(subtasksRes.subtasks?.[1].title).toBe("Child 2");
    });

    it("should retrieve a task by ID including relation counts via getTaskByIdAction", async () => {
      userA = await createTestUser();
      await loginAsTestUser(userA);

      const created = await createTaskAction({ title: "Detailed Task" });
      const taskId = created.task!.id;

      await createTaskAction({ title: "Subtask", parentId: taskId });

      const fetched = await getTaskByIdAction(taskId);
      expect(fetched.error).toBeUndefined();
      expect(fetched.task?.id).toBe(taskId);
      expect(fetched.task?.title).toBe("Detailed Task");
      expect(fetched.task?.subtaskCount).toBe(1);
    });
  });

  describe("toggleTaskStatusAction & updateTaskAction", () => {
    it("should toggle completed status accurately", async () => {
      userA = await createTestUser();
      await loginAsTestUser(userA);

      const taskRes = await createTaskAction({ title: "Checkable Task" });
      const taskId = taskRes.task!.id;

      const toggleOn = await toggleTaskStatusAction(taskId, true);
      expect(toggleOn.success).toBe(true);

      const [updated] = await db
        .select()
        .from(tasks)
        .where(eq(tasks.id, taskId));
      expect(updated.completed).toBe(true);

      const toggleOff = await toggleTaskStatusAction(taskId, false);
      expect(toggleOff.success).toBe(true);

      const [updatedAgain] = await db
        .select()
        .from(tasks)
        .where(eq(tasks.id, taskId));
      expect(updatedAgain.completed).toBe(false);
    });

    it("should update task details and enforce multi-tenant isolation", async () => {
      userA = await createTestUser();
      userB = await createTestUser();

      await loginAsTestUser(userA);
      const taskA = await createTaskAction({ title: "User A Task" });
      const taskId = taskA.task!.id;

      // User B tries to update User A's task
      await loginAsTestUser(userB);
      const unauthorizedUpdate = await updateTaskAction(taskId, {
        title: "Hacked Title",
      });
      expect(unauthorizedUpdate.error).toBe("Task not found.");

      // User A updates their own task
      await loginAsTestUser(userA);
      const authorizedUpdate = await updateTaskAction(taskId, {
        title: "Updated Title",
        content: "New rich markdown notes",
        time: "14:30",
        duration: 90,
      });

      expect(authorizedUpdate.error).toBeUndefined();
      expect(authorizedUpdate.task?.title).toBe("Updated Title");
      expect(authorizedUpdate.task?.content).toBe("New rich markdown notes");
      expect(authorizedUpdate.task?.time).toBe("14:30");
      expect(authorizedUpdate.task?.duration).toBe(90);
    });

    it("should update and clear task description via description parameter", async () => {
      userA = await createTestUser();
      await loginAsTestUser(userA);

      const created = await createTaskAction({
        title: "Task to update description",
        description: "Initial description",
      });
      const taskId = created.task!.id;

      // Update description
      const updated = await updateTaskAction(taskId, {
        description: "Updated description via parameter",
      });
      expect(updated.error).toBeUndefined();
      expect(updated.task?.content).toBe("Updated description via parameter");

      const [dbRowUpdated] = await db
        .select()
        .from(tasks)
        .where(eq(tasks.id, taskId));
      expect(dbRowUpdated.content).toBe("Updated description via parameter");

      // Clear description
      const cleared = await updateTaskAction(taskId, {
        description: "",
      });
      expect(cleared.error).toBeUndefined();
      expect(cleared.task?.content).toBe("");

      const [dbRowCleared] = await db
        .select()
        .from(tasks)
        .where(eq(tasks.id, taskId));
      expect(dbRowCleared.content).toBe("");
    });
  });

  describe("moveOrReorderTasksAction", () => {
    it("should reorder tasks and change dates accurately", async () => {
      userA = await createTestUser();
      await loginAsTestUser(userA);

      const t1 = await createTaskAction({ title: "Task 1", date: "2026-09-15" });
      const t2 = await createTaskAction({ title: "Task 2", date: "2026-09-15" });
      const t3 = await createTaskAction({ title: "Task 3", date: "2026-09-15" });

      const id1 = t1.task!.id;
      const id2 = t2.task!.id;
      const id3 = t3.task!.id;

      // Invert order: Task 3, Task 1, Task 2 on date 2026-09-16
      const moveRes = await moveOrReorderTasksAction({
        taskId: id3,
        targetDate: "2026-09-16",
        targetParentId: null,
        targetOrderedIds: [id3, id1, id2],
      });

      expect(moveRes.success).toBe(true);

      const [task3After] = await db.select().from(tasks).where(eq(tasks.id, id3));
      expect(task3After.date).toBe("2026-09-16");
      expect(task3After.order).toBe(0);

      const [task1After] = await db.select().from(tasks).where(eq(tasks.id, id1));
      expect(task1After.order).toBe(1);

      const [task2After] = await db.select().from(tasks).where(eq(tasks.id, id2));
      expect(task2After.order).toBe(2);
    });

    it("should prevent cyclic / invalid subtask relations", async () => {
      userA = await createTestUser();
      await loginAsTestUser(userA);

      const task = await createTaskAction({ title: "Solo Task" });
      const taskId = task.task!.id;

      // Cannot be a subtask of itself
      const selfSubtask = await moveOrReorderTasksAction({
        taskId,
        targetParentId: taskId,
        targetOrderedIds: [taskId],
      });
      expect(selfSubtask.error).toBe("A task cannot be a subtask of itself.");
    });
  });

  describe("deleteTaskAction & Cascade Cleanup", () => {
    it("should delete task and cascade-delete child subtasks", async () => {
      userA = await createTestUser();
      await loginAsTestUser(userA);

      const parent = await createTaskAction({ title: "Parent to delete" });
      const parentId = parent.task!.id;

      const child1 = await createTaskAction({ title: "Subtask 1", parentId });
      const child2 = await createTaskAction({ title: "Subtask 2", parentId });

      const deleteRes = await deleteTaskAction(parentId);
      expect(deleteRes.success).toBe(true);

      // Verify parent deleted
      const [parentCheck] = await db
        .select()
        .from(tasks)
        .where(eq(tasks.id, parentId));
      expect(parentCheck).toBeUndefined();

      // Verify child subtasks cascade deleted
      const [child1Check] = await db
        .select()
        .from(tasks)
        .where(eq(tasks.id, child1.task!.id));
      expect(child1Check).toBeUndefined();

      const [child2Check] = await db
        .select()
        .from(tasks)
        .where(eq(tasks.id, child2.task!.id));
      expect(child2Check).toBeUndefined();
    });
  });

  describe("getWeekTasksAction", () => {
    it("should fetch scheduled week tasks and unscheduled backlog tasks with subtask counts", async () => {
      userA = await createTestUser();
      await loginAsTestUser(userA);

      // Scheduled task within week
      const scheduled = await createTaskAction({
        title: "This week's work",
        date: "2026-09-15",
      });
      // Subtask for scheduled task
      await createTaskAction({
        title: "Subtask completed",
        parentId: scheduled.task!.id,
      });

      // Unscheduled task
      await createTaskAction({
        title: "Backlog idea",
        date: null,
      });

      // Scheduled task outside week
      await createTaskAction({
        title: "Future work",
        date: "2026-10-20",
      });

      const res = await getWeekTasksAction("2026-09-14", "2026-09-20");
      expect(res.error).toBeUndefined();
      expect(res.tasks).toBeDefined();

      const titles = res.tasks!.map((t) => t.title);
      expect(titles).toContain("This week's work");
      expect(titles).toContain("Backlog idea");
      expect(titles).not.toContain("Future work");

      // Verify subtask count aggregation on parent
      const parentTask = res.tasks!.find((t) => t.id === scheduled.task!.id);
      expect(parentTask?.subtaskCount).toBe(1);
    });
  });
});
