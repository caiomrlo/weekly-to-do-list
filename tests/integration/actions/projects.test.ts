import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import {
  getUserProjectsAction,
  createProjectAction,
  updateProjectAction,
  deleteProjectAction,
} from "@/app/actions/projects";
import { db, cleanupTestUser } from "../setup/test-db";
import {
  createTestUser,
  loginAsTestUser,
  logoutTestUser,
  TestUserData,
} from "../setup/auth-helper";
import { projects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

describe("Integration: Projects Actions", () => {
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
    it("should reject all actions when not authenticated", async () => {
      const getRes = await getUserProjectsAction();
      expect(getRes.error).toBe("Not authenticated.");

      const createRes = await createProjectAction({ name: "Work" });
      expect(createRes.error).toBe("Not authenticated.");

      const updateRes = await updateProjectAction("random-id", { name: "New" });
      expect(updateRes.error).toBe("Not authenticated.");

      const deleteRes = await deleteProjectAction("random-id");
      expect(deleteRes.error).toBe("Not authenticated.");
    });
  });

  describe("createProjectAction", () => {
    it("should reject empty project names", async () => {
      userA = await createTestUser();
      await loginAsTestUser(userA);

      const res = await createProjectAction({ name: "   " });
      expect(res.error).toBe("Project name cannot be empty.");
    });

    it("should reject project names exceeding 50 characters", async () => {
      userA = await createTestUser();
      await loginAsTestUser(userA);

      const longName = "A".repeat(51);
      const res = await createProjectAction({ name: longName });
      expect(res.error).toBe("Project name must be at most 50 characters.");
    });

    it("should create project with default color when omitted or invalid", async () => {
      userA = await createTestUser();
      await loginAsTestUser(userA);

      const res = await createProjectAction({
        name: "Default Color Project",
        color: "invalid-neon-color",
      });

      expect(res.error).toBeUndefined();
      expect(res.project).toBeDefined();
      expect(res.project?.name).toBe("Default Color Project");
      expect(res.project?.color).toBe("amber");
      expect(revalidatePath).toHaveBeenCalledWith("/");

      // Verify in DB
      const [saved] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, res.project!.id));
      expect(saved.userId).toBe(userA.id);
    });

    it("should create project with valid custom palette color", async () => {
      userA = await createTestUser();
      await loginAsTestUser(userA);

      const res = await createProjectAction({
        name: "Emerald Project",
        color: "emerald",
      });

      expect(res.error).toBeUndefined();
      expect(res.project?.color).toBe("emerald");
    });
  });

  describe("getUserProjectsAction & Multi-Tenant Isolation", () => {
    it("should return projects in alphabetical order and enforce user isolation", async () => {
      userA = await createTestUser();
      userB = await createTestUser();

      // Create projects for User A
      await loginAsTestUser(userA);
      await createProjectAction({ name: "Zeta Initiative", color: "violet" });
      await createProjectAction({ name: "Alpha Core", color: "indigo" });

      // Create project for User B
      await loginAsTestUser(userB);
      await createProjectAction({ name: "User B Secret Project", color: "rose" });

      // Fetch as User A
      await loginAsTestUser(userA);
      const resA = await getUserProjectsAction();
      expect(resA.error).toBeUndefined();
      expect(resA.projects?.length).toBe(2);
      expect(resA.projects?.[0].name).toBe("Alpha Core");
      expect(resA.projects?.[1].name).toBe("Zeta Initiative");
      expect(resA.projects?.some((p) => p.name.includes("User B"))).toBe(false);

      // Fetch as User B
      await loginAsTestUser(userB);
      const resB = await getUserProjectsAction();
      expect(resB.error).toBeUndefined();
      expect(resB.projects?.length).toBe(1);
      expect(resB.projects?.[0].name).toBe("User B Secret Project");
    });
  });

  describe("updateProjectAction", () => {
    it("should update project name and color when owned by user", async () => {
      userA = await createTestUser();
      await loginAsTestUser(userA);

      const created = await createProjectAction({ name: "Old Name", color: "sky" });
      const projId = created.project!.id;

      const updateRes = await updateProjectAction(projId, {
        name: "Renamed Project",
        color: "orange",
      });

      expect(updateRes.error).toBeUndefined();
      expect(updateRes.project?.name).toBe("Renamed Project");
      expect(updateRes.project?.color).toBe("orange");

      const [saved] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, projId));
      expect(saved.name).toBe("Renamed Project");
      expect(saved.color).toBe("orange");
    });

    it("should reject updating a project owned by another user", async () => {
      userA = await createTestUser();
      userB = await createTestUser();

      await loginAsTestUser(userA);
      const created = await createProjectAction({ name: "User A Project" });
      const projId = created.project!.id;

      // Try updating as User B
      await loginAsTestUser(userB);
      const updateRes = await updateProjectAction(projId, { name: "Hacked!" });

      expect(updateRes.error).toBe("Project not found or access denied.");

      // Check DB remains untouched
      const [unchanged] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, projId));
      expect(unchanged.name).toBe("User A Project");
    });
  });

  describe("deleteProjectAction", () => {
    it("should delete project and prevent other users from deleting it", async () => {
      userA = await createTestUser();
      userB = await createTestUser();

      await loginAsTestUser(userA);
      const created = await createProjectAction({ name: "To Delete" });
      const projId = created.project!.id;

      // User B tries to delete User A's project
      await loginAsTestUser(userB);
      const unauthorizedDelete = await deleteProjectAction(projId);
      expect(unauthorizedDelete.success).toBe(true); // Action deletes matching (id, userId), doesn't throw if 0 rows deleted

      // Verify User A's project still exists
      const [stillExists] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, projId));
      expect(stillExists).toBeDefined();

      // User A deletes their own project
      await loginAsTestUser(userA);
      const authorizedDelete = await deleteProjectAction(projId);
      expect(authorizedDelete.success).toBe(true);

      const [deleted] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, projId));
      expect(deleted).toBeUndefined();
    });
  });
});
