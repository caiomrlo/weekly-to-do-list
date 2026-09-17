import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from "vitest";
import {
  createTaskAction,
  updateTaskAssigneesAction,
  getTaskByIdAction,
  getWeekTasksAction,
  getKanbanTasksAction,
  deleteTaskAction,
} from "@/app/actions/tasks";
import { db, cleanupTestUser } from "../setup/test-db";
import {
  createTestUser,
  loginAsTestUser,
  logoutTestUser,
  TestUserData,
} from "../setup/auth-helper";
import {
  workspaceMembers,
  taskAssignees,
} from "@/db/schema";
import { getActiveWorkspaceContext } from "@/lib/workspace";
import { eq } from "drizzle-orm";

describe("Integration: Task Assignees System", () => {
  let userA: TestUserData;
  let userB: TestUserData;
  let userC: TestUserData;
  let workspaceIdA: string;

  beforeAll(async () => {
    userA = await createTestUser();
    userB = await createTestUser();
    userC = await createTestUser(); // userC is not in userA's workspace

    const { activeWorkspace } = await getActiveWorkspaceContext(userA.id);
    workspaceIdA = activeWorkspace.id;

    await db.insert(workspaceMembers).values({
      workspaceId: workspaceIdA,
      userId: userB.id,
      role: "member",
    });
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    logoutTestUser();
  });

  afterAll(async () => {
    if (userA?.id) await cleanupTestUser(userA.id);
    if (userB?.id) await cleanupTestUser(userB.id);
    if (userC?.id) await cleanupTestUser(userC.id);
  });

  describe("Authentication Guard", () => {
    it("should reject updateTaskAssigneesAction when not authenticated", async () => {
      const res = await updateTaskAssigneesAction("random-task-id", ["some-user-id"]);
      expect(res.error).toBe("Not authenticated.");
    });
  });

  describe("Workspace Boundary & Assignee Management", () => {
    it("should reject assigning a user who is not a member of the workspace", async () => {
      await loginAsTestUser(userA);

      const created = await createTaskAction({
        title: "Task for assignees",
        workspaceId: workspaceIdA,
        date: "2026-09-15",
      });
      expect(created.error).toBeUndefined();
      const taskId = created.task!.id;

      // Try assigning userC (not in workspace)
      const res = await updateTaskAssigneesAction(taskId, [userC.id]);
      expect(res.error).toBe("One or more users are not members of this workspace.");
    });

    it("should successfully assign workspace members and return assignees in getTaskByIdAction", async () => {
      await loginAsTestUser(userA);

      const created = await createTaskAction({
        title: "Multi-assignee Task",
        workspaceId: workspaceIdA,
        date: "2026-09-15",
      });
      const taskId = created.task!.id;

      // Assign userA and userB
      const assignRes = await updateTaskAssigneesAction(taskId, [userA.id, userB.id]);
      expect(assignRes.error).toBeUndefined();
      expect(assignRes.assignees).toHaveLength(2);
      const assignedIds = assignRes.assignees!.map((a) => a.id);
      expect(assignedIds).toContain(userA.id);
      expect(assignedIds).toContain(userB.id);

      // Verify getTaskByIdAction includes assignees
      const getRes = await getTaskByIdAction(taskId);
      expect(getRes.error).toBeUndefined();
      expect(getRes.task?.assignees).toHaveLength(2);
      expect(getRes.task?.assignees?.map((a) => a.id)).toContain(userA.id);
      expect(getRes.task?.assignees?.map((a) => a.id)).toContain(userB.id);
    });

    it("should return assignees in getWeekTasksAction and getKanbanTasksAction", async () => {
      await loginAsTestUser(userA);

      const created = await createTaskAction({
        title: "Board and Kanban Card Task",
        workspaceId: workspaceIdA,
        date: "2026-09-16",
        assigneeIds: [userB.id],
      });
      expect(created.error).toBeUndefined();
      expect(created.task?.assignees).toHaveLength(1);
      expect(created.task?.assignees![0].id).toBe(userB.id);

      // Test getWeekTasksAction
      const weekRes = await getWeekTasksAction("2026-09-14", "2026-09-20");
      expect(weekRes.error).toBeUndefined();
      const weekTask = weekRes.tasks?.find((t) => t.id === created.task!.id);
      expect(weekTask).toBeDefined();
      expect(weekTask?.assignees).toHaveLength(1);
      expect(weekTask?.assignees![0].id).toBe(userB.id);

      // Test getKanbanTasksAction
      const kanbanRes = await getKanbanTasksAction();
      expect(kanbanRes.error).toBeUndefined();
      const kanbanTask = kanbanRes.tasks?.find((t) => t.id === created.task!.id);
      expect(kanbanTask).toBeDefined();
      expect(kanbanTask?.assignees).toHaveLength(1);
      expect(kanbanTask?.assignees![0].id).toBe(userB.id);
    });

    it("should unassign members and update correctly", async () => {
      await loginAsTestUser(userA);

      const created = await createTaskAction({
        title: "Unassign Test Task",
        workspaceId: workspaceIdA,
        assigneeIds: [userA.id, userB.id],
      });
      const taskId = created.task!.id;
      expect(created.task?.assignees).toHaveLength(2);

      // Unassign userB, keeping only userA
      const res1 = await updateTaskAssigneesAction(taskId, [userA.id]);
      expect(res1.error).toBeUndefined();
      expect(res1.assignees).toHaveLength(1);
      expect(res1.assignees![0].id).toBe(userA.id);

      // Unassign all
      const res2 = await updateTaskAssigneesAction(taskId, []);
      expect(res2.error).toBeUndefined();
      expect(res2.assignees).toHaveLength(0);

      const check = await getTaskByIdAction(taskId);
      expect(check.task?.assignees).toHaveLength(0);
    });

    it("should cascade-delete taskAssignees when task is deleted", async () => {
      await loginAsTestUser(userA);

      const created = await createTaskAction({
        title: "Task to delete with assignees",
        workspaceId: workspaceIdA,
        assigneeIds: [userA.id, userB.id],
      });
      const taskId = created.task!.id;

      // Verify assignees exist in DB
      const beforeDelete = await db
        .select()
        .from(taskAssignees)
        .where(eq(taskAssignees.taskId, taskId));
      expect(beforeDelete).toHaveLength(2);

      // Delete task
      const delRes = await deleteTaskAction(taskId);
      expect(delRes.success).toBe(true);

      // Verify cascade deleted from taskAssignees
      const afterDelete = await db
        .select()
        .from(taskAssignees)
        .where(eq(taskAssignees.taskId, taskId));
      expect(afterDelete).toHaveLength(0);
    });
  });
});
