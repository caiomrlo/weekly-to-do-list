import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import {
  getWorkspaceInviteLinkAction,
  toggleWorkspaceInviteLinkAction,
  regenerateWorkspaceInviteLinkAction,
  getWorkspaceMembersAction,
} from "@/app/actions/workspace-invites";
import { GET } from "@/app/invite/[token]/route";
import { NextRequest } from "next/server";
import { db, cleanupTestUser } from "../setup/test-db";
import {
  createTestUser,
  loginAsTestUser,
  logoutTestUser,
  TestUserData,
} from "../setup/auth-helper";
import {
  workspaces,
  workspaceMembers,
  workspaceInvites,
  users,
} from "@/db/schema";
import { and, eq } from "drizzle-orm";

describe("Integration: Workspace Invites & Membership System", () => {
  let userA: TestUserData | undefined;
  let userB: TestUserData | undefined;
  let workspaceIdA: string;

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
      const getRes = await getWorkspaceInviteLinkAction("some-workspace-id");
      expect(getRes.error).toBe("Not authenticated.");

      const toggleRes = await toggleWorkspaceInviteLinkAction("some-workspace-id", true);
      expect(toggleRes.error).toBe("Not authenticated.");

      const regenRes = await regenerateWorkspaceInviteLinkAction("some-workspace-id");
      expect(regenRes.error).toBe("Not authenticated.");

      const membersRes = await getWorkspaceMembersAction("some-workspace-id");
      expect(membersRes.error).toBe("Not authenticated.");
    });
  });

  describe("Permission & Workspace Boundary Guard", () => {
    it("should reject actions when user is not a member of the workspace", async () => {
      userA = await createTestUser();
      userB = await createTestUser();

      // Create workspace for User A
      const [ws] = await db
        .insert(workspaces)
        .values({
          name: "User A Workspace",
          ownerId: userA.id,
          isDefault: true,
        })
        .returning();
      workspaceIdA = ws.id;

      await db.insert(workspaceMembers).values({
        workspaceId: workspaceIdA,
        userId: userA.id,
        role: "owner",
      });

      // Login as User B (not a member of User A's workspace)
      await loginAsTestUser(userB);

      const getRes = await getWorkspaceInviteLinkAction(workspaceIdA);
      expect(getRes.error).toBe("Access denied to this workspace.");

      const toggleRes = await toggleWorkspaceInviteLinkAction(workspaceIdA, true);
      expect(toggleRes.error).toBe("Access denied to this workspace.");

      const membersRes = await getWorkspaceMembersAction(workspaceIdA);
      expect(membersRes.error).toBe("Access denied to this workspace.");
    });
  });

  describe("Invite Link Generation & Toggling", () => {
    it("should toggle invite link on, return stable token, and toggle off", async () => {
      await loginAsTestUser(userA!);

      // Initially no invite link
      const initialRes = await getWorkspaceInviteLinkAction(workspaceIdA);
      expect(initialRes.enabled).toBe(false);

      // Enable invite link
      const enableRes = await toggleWorkspaceInviteLinkAction(workspaceIdA, true);
      expect(enableRes.success).toBe(true);
      expect(enableRes.enabled).toBe(true);
      expect(enableRes.token).toBeDefined();
      expect(enableRes.token?.length).toBe(32);

      const token1 = enableRes.token!;

      // Subsequent fetch returns same active link
      const fetchedRes = await getWorkspaceInviteLinkAction(workspaceIdA);
      expect(fetchedRes.enabled).toBe(true);
      expect(fetchedRes.token).toBe(token1);

      // Regenerating link revokes token1 and creates token2
      const regenRes = await regenerateWorkspaceInviteLinkAction(workspaceIdA);
      expect(regenRes.success).toBe(true);
      expect(regenRes.enabled).toBe(true);
      expect(regenRes.token).toBeDefined();
      expect(regenRes.token).not.toBe(token1);

      const token2 = regenRes.token!;

      // Check DB: token1 should be revoked, token2 active
      const [oldInvite] = await db
        .select()
        .from(workspaceInvites)
        .where(eq(workspaceInvites.token, token1));
      expect(oldInvite.status).toBe("revoked");

      const [newInvite] = await db
        .select()
        .from(workspaceInvites)
        .where(eq(workspaceInvites.token, token2));
      expect(newInvite.status).toBe("active");

      // Disabling link marks active invite as revoked
      const disableRes = await toggleWorkspaceInviteLinkAction(workspaceIdA, false);
      expect(disableRes.success).toBe(true);
      expect(disableRes.enabled).toBe(false);

      const disabledCheck = await getWorkspaceInviteLinkAction(workspaceIdA);
      expect(disabledCheck.enabled).toBe(false);
    });
  });

  describe("Workspace Members Retrieval", () => {
    it("should return all real members with correct roles and owner flag", async () => {
      await loginAsTestUser(userA!);

      const res = await getWorkspaceMembersAction(workspaceIdA);
      expect(res.members).toBeDefined();
      expect(res.members?.length).toBe(1);
      expect(res.members?.[0].userId).toBe(userA!.id);
      expect(res.members?.[0].isOwner).toBe(true);
      expect(res.members?.[0].isCurrentUser).toBe(true);
      expect(res.isOwner).toBe(true);
    });
  });

  describe("Invite Acceptance Route Handler (/invite/[token])", () => {
    it("should redirect unauthenticated users to login with redirect parameter", async () => {
      logoutTestUser();

      const req = new NextRequest("http://localhost:3000/invite/some-token-123");
      const res = await GET(req, {
        params: Promise.resolve({ token: "some-token-123" }),
      });

      expect(res.status).toBe(307); // NextResponse.redirect default
      const location = res.headers.get("location");
      expect(location).toContain("/login");
      expect(location).toContain("redirect=%2Finvite%2Fsome-token-123");
    });

    it("should redirect to error page when token is invalid or revoked", async () => {
      await loginAsTestUser(userB!);

      const req = new NextRequest("http://localhost:3000/invite/non-existent-token");
      const res = await GET(req, {
        params: Promise.resolve({ token: "non-existent-token" }),
      });

      expect(res.status).toBe(307);
      const location = res.headers.get("location");
      expect(location).toContain("/invite/error?reason=invalid");
    });

    it("should add authenticated user to workspace and redirect to home", async () => {
      // User A generates an invite link
      await loginAsTestUser(userA!);
      const enableRes = await toggleWorkspaceInviteLinkAction(workspaceIdA, true);
      const activeToken = enableRes.token!;

      // User B visits the invite link
      await loginAsTestUser(userB!);
      const req = new NextRequest(`http://localhost:3000/invite/${activeToken}`);
      const res = await GET(req, {
        params: Promise.resolve({ token: activeToken }),
      });

      expect(res.status).toBe(307);
      const location = res.headers.get("location");
      expect(location).toBe("http://localhost:3000/");

      // Check that active_workspace_id cookie was set in the response
      const setCookie = res.headers.get("set-cookie");
      expect(setCookie).toContain(`active_workspace_id=${workspaceIdA}`);

      // Verify User B is now a member of workspaceIdA in the database
      const [memberB] = await db
        .select()
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, workspaceIdA),
            eq(workspaceMembers.userId, userB!.id)
          )
        );
      expect(memberB).toBeDefined();
      expect(memberB.role).toBe("member");

      // Verify User B's activeWorkspaceId preference was updated
      const [userBRecord] = await db
        .select({ preferences: users.preferences })
        .from(users)
        .where(eq(users.id, userB!.id));
      expect(userBRecord.preferences.activeWorkspaceId).toBe(workspaceIdA);

      // Idempotency: visiting again should not create duplicate membership
      const res2 = await GET(req, {
        params: Promise.resolve({ token: activeToken }),
      });
      expect(res2.status).toBe(307);

      const allMembersB = await db
        .select()
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, workspaceIdA),
            eq(workspaceMembers.userId, userB!.id)
          )
        );
      expect(allMembersB.length).toBe(1);
    });
  });
});
