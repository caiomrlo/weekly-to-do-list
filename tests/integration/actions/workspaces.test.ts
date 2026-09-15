import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import {
  getUserWorkspacesAction,
  createWorkspaceAction,
  renameWorkspaceAction,
  deleteWorkspaceAction,
  switchWorkspaceAction,
} from "@/app/actions/workspaces";
import { createTaskAction, getWeekTasksAction } from "@/app/actions/tasks";
import { createProjectAction, getUserProjectsAction } from "@/app/actions/projects";
import { createTagAction, getUserTagsAction } from "@/app/actions/tags";
import { createDocAction, getUserDocsAction } from "@/app/actions/docs";
import { cleanupTestUser } from "../setup/test-db";
import {
  createTestUser,
  loginAsTestUser,
  logoutTestUser,
  TestUserData,
} from "../setup/auth-helper";

describe("Integration: Workspaces Actions & Strict Isolation", () => {
  let userA: TestUserData | undefined;
  let userB: TestUserData | undefined;

  beforeEach(async () => {
    vi.clearAllMocks();
    logoutTestUser();
  });

  afterAll(async () => {
    if (userA?.id) await cleanupTestUser(userA.id);
    if (userB?.id) await cleanupTestUser(userB.id);
  });

  describe("Authentication Guard", () => {
    it("should reject all actions when not authenticated", async () => {
      const getRes = await getUserWorkspacesAction();
      expect(getRes.error).toBe("Not authenticated.");

      const createRes = await createWorkspaceAction({ name: "Personal" });
      expect(createRes.error).toBe("Not authenticated.");

      const renameRes = await renameWorkspaceAction("random-id", "Updated");
      expect(renameRes.error).toBe("Not authenticated.");

      const deleteRes = await deleteWorkspaceAction("random-id");
      expect(deleteRes.error).toBe("Not authenticated.");

      const switchRes = await switchWorkspaceAction("random-id");
      expect(switchRes.error).toBe("Not authenticated.");
    });
  });

  describe("Workspace Management & CRUD", () => {
    it("should retrieve default workspace for user", async () => {
      userA = await createTestUser();
      await loginAsTestUser(userA);

      const res = await getUserWorkspacesAction();
      expect(res.workspaces).toBeDefined();
      expect(res.workspaces?.length).toBe(1);
      expect(res.workspaces?.[0].name).toBe("My Workspace");
      expect(res.workspaces?.[0].isDefault).toBe(true);
      expect(res.activeWorkspaceId).toBe(res.workspaces?.[0].id);
    });

    it("should create a new workspace and switch to it", async () => {
      userA = await createTestUser();
      await loginAsTestUser(userA);

      const createRes = await createWorkspaceAction({ name: "Side Projects" });
      expect(createRes.success).toBe(true);
      expect(createRes.workspace).toBeDefined();
      expect(createRes.workspace?.name).toBe("Side Projects");
      expect(createRes.workspace?.isDefault).toBe(false);
      expect(createRes.activeWorkspaceId).toBe(createRes.workspace?.id);

      const listRes = await getUserWorkspacesAction();
      expect(listRes.workspaces?.length).toBe(2);
      expect(listRes.activeWorkspaceId).toBe(createRes.workspace?.id);
    });

    it("should rename a workspace", async () => {
      userA = await createTestUser();
      await loginAsTestUser(userA);

      const createRes = await createWorkspaceAction({ name: "Work Old" });
      const wsId = createRes.workspace!.id;

      const renameRes = await renameWorkspaceAction(wsId, "Work 2026");
      expect(renameRes.success).toBe(true);
      expect(renameRes.workspace?.name).toBe("Work 2026");

      const listRes = await getUserWorkspacesAction();
      const renamed = listRes.workspaces?.find((w) => w.id === wsId);
      expect(renamed?.name).toBe("Work 2026");
    });

    it("should switch between workspaces", async () => {
      userA = await createTestUser();
      await loginAsTestUser(userA);

      const initialRes = await getUserWorkspacesAction();
      const defaultWsId = initialRes.workspaces![0].id;

      const createRes = await createWorkspaceAction({ name: "Workspace 2" });
      const secondWsId = createRes.workspace!.id;
      expect(createRes.activeWorkspaceId).toBe(secondWsId);

      const switchBackRes = await switchWorkspaceAction(defaultWsId);
      expect(switchBackRes.success).toBe(true);

      const listRes = await getUserWorkspacesAction();
      expect(listRes.activeWorkspaceId).toBe(defaultWsId);
    });

    it("should prevent deletion of the default workspace", async () => {
      userA = await createTestUser();
      await loginAsTestUser(userA);

      const initialRes = await getUserWorkspacesAction();
      const defaultWs = initialRes.workspaces![0];

      // Add a second workspace so count > 1
      await createWorkspaceAction({ name: "Secondary" });

      const delRes = await deleteWorkspaceAction(defaultWs.id);
      expect(delRes.error).toBe("The default workspace cannot be deleted.");
    });

    it("should delete a non-default workspace and fallback to default", async () => {
      userA = await createTestUser();
      await loginAsTestUser(userA);

      const initialRes = await getUserWorkspacesAction();
      const defaultWsId = initialRes.workspaces![0].id;

      const createRes = await createWorkspaceAction({ name: "Temporary WS" });
      const tempWsId = createRes.workspace!.id;

      // Currently active is tempWsId
      const delRes = await deleteWorkspaceAction(tempWsId);
      expect(delRes.success).toBe(true);
      expect(delRes.nextActiveWorkspaceId).toBe(defaultWsId);

      const listRes = await getUserWorkspacesAction();
      expect(listRes.workspaces?.length).toBe(1);
      expect(listRes.activeWorkspaceId).toBe(defaultWsId);
    });
  });

  describe("Total Data Isolation Between Workspaces", () => {
    it("should strictly isolate tasks between workspaces", async () => {
      userA = await createTestUser();
      await loginAsTestUser(userA);

      // In Default Workspace: Create Task
      await createTaskAction({
        title: "Task in Default WS",
        date: "2026-09-15",
      });

      const week1 = await getWeekTasksAction("2026-09-14", "2026-09-20");
      expect(week1.tasks?.some((t) => t.title === "Task in Default WS")).toBe(true);

      // Create and switch to Secondary Workspace
      await createWorkspaceAction({ name: "Secondary Workspace" });

      // Secondary workspace should NOT see tasks from Default workspace
      const week2 = await getWeekTasksAction("2026-09-14", "2026-09-20");
      expect(week2.tasks?.some((t) => t.title === "Task in Default WS")).toBe(false);

      // Create Task in Secondary Workspace
      await createTaskAction({
        title: "Task in Secondary WS",
        date: "2026-09-15",
      });

      const week2Updated = await getWeekTasksAction("2026-09-14", "2026-09-20");
      expect(week2Updated.tasks?.some((t) => t.title === "Task in Secondary WS")).toBe(true);
      expect(week2Updated.tasks?.some((t) => t.title === "Task in Default WS")).toBe(false);
    });

    it("should strictly isolate projects, tags, and docs between workspaces", async () => {
      userA = await createTestUser();
      await loginAsTestUser(userA);

      // Default Workspace
      const defaultWsRes = await getUserWorkspacesAction();
      const defaultWsId = defaultWsRes.workspaces![0].id;

      await createProjectAction({ name: "Default Project" });
      await createTagAction({ name: "Default Tag" });
      await createDocAction({ title: "Default Note" });

      expect((await getUserProjectsAction()).projects?.some((p) => p.name === "Default Project")).toBe(true);
      expect((await getUserTagsAction()).tags?.some((t) => t.name === "Default Tag")).toBe(true);
      expect((await getUserDocsAction()).docs?.some((d) => d.title === "Default Note")).toBe(true);

      // Switch to a new workspace
      await createWorkspaceAction({ name: "Client Workspace" });

      // In Client Workspace: should have NO projects, tags, or docs from Default
      expect((await getUserProjectsAction()).projects?.some((p) => p.name === "Default Project")).toBe(false);
      expect((await getUserTagsAction()).tags?.some((t) => t.name === "Default Tag")).toBe(false);
      expect((await getUserDocsAction()).docs?.some((d) => d.title === "Default Note")).toBe(false);

      // Create distinct project, tag, doc in Client Workspace
      await createProjectAction({ name: "Client Project" });
      await createTagAction({ name: "Client Tag" });
      await createDocAction({ title: "Client Note" });

      expect((await getUserProjectsAction()).projects?.some((p) => p.name === "Client Project")).toBe(true);
      expect((await getUserTagsAction()).tags?.some((t) => t.name === "Client Tag")).toBe(true);
      expect((await getUserDocsAction()).docs?.some((d) => d.title === "Client Note")).toBe(true);

      // Switch back to Default Workspace
      await switchWorkspaceAction(defaultWsId);

      expect((await getUserProjectsAction()).projects?.some((p) => p.name === "Default Project")).toBe(true);
      expect((await getUserProjectsAction()).projects?.some((p) => p.name === "Client Project")).toBe(false);
      expect((await getUserDocsAction()).docs?.some((d) => d.title === "Default Note")).toBe(true);
      expect((await getUserDocsAction()).docs?.some((d) => d.title === "Client Note")).toBe(false);
    });
  });
});
