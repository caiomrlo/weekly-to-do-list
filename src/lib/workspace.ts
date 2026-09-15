import { db } from "@/db";
import {
  workspaces,
  workspaceMembers,
  users,
  Workspace,
  DEFAULT_USER_PREFERENCES,
} from "@/db/schema";
import { eq, asc, desc } from "drizzle-orm";
import { cookies } from "next/headers";

export const ACTIVE_WORKSPACE_COOKIE = "active_workspace_id";

export interface WorkspaceContext {
  activeWorkspace: Workspace;
  workspaces: Workspace[];
}

/**
 * Retrieves or initializes the active workspace context for a user.
 * Seamlessly resolves cookie, user preferences, default workspace,
 * or auto-creates "My Workspace" if no workspace exists yet.
 */
export async function getActiveWorkspaceContext(
  sessionUserId: string
): Promise<WorkspaceContext> {
  const [user] = await db
    .select({ preferences: users.preferences })
    .from(users)
    .where(eq(users.id, sessionUserId))
    .limit(1);

  // Fetch all workspaces where user is a member
  const memberWorkspaces = await db
    .select({ workspace: workspaces })
    .from(workspaces)
    .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(eq(workspaceMembers.userId, sessionUserId))
    .orderBy(desc(workspaces.isDefault), asc(workspaces.createdAt));

  let workspaceList = memberWorkspaces.map((r) => r.workspace);

  // If user has no workspace at all, transparently create default "My Workspace"
  if (workspaceList.length === 0) {
    const now = new Date();
    const [newDefaultWorkspace] = await db
      .insert(workspaces)
      .values({
        name: "My Workspace",
        ownerId: sessionUserId,
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    await db.insert(workspaceMembers).values({
      workspaceId: newDefaultWorkspace.id,
      userId: sessionUserId,
      role: "owner",
      joinedAt: now,
    });

    const mergedPrefs = {
      ...(user?.preferences || DEFAULT_USER_PREFERENCES),
      activeWorkspaceId: newDefaultWorkspace.id,
    };

    await db
      .update(users)
      .set({ preferences: mergedPrefs })
      .where(eq(users.id, sessionUserId));

    workspaceList = [newDefaultWorkspace];
    return {
      activeWorkspace: newDefaultWorkspace,
      workspaces: workspaceList,
    };
  }

  // 1. Try reading active workspace from cookie
  const cookieStore = await cookies();
  const cookieWorkspaceId = cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value;

  if (cookieWorkspaceId) {
    const matchingFromCookie = workspaceList.find((w) => w.id === cookieWorkspaceId);
    if (matchingFromCookie) {
      return {
        activeWorkspace: matchingFromCookie,
        workspaces: workspaceList,
      };
    }
  }

  // 2. Try reading from user preferences
  const prefWorkspaceId = user?.preferences?.activeWorkspaceId;
  if (prefWorkspaceId) {
    const matchingFromPref = workspaceList.find((w) => w.id === prefWorkspaceId);
    if (matchingFromPref) {
      return {
        activeWorkspace: matchingFromPref,
        workspaces: workspaceList,
      };
    }
  }

  // 3. Fall back to the default workspace or first available workspace
  const defaultWorkspace =
    workspaceList.find((w) => w.isDefault) || workspaceList[0];

  return {
    activeWorkspace: defaultWorkspace,
    workspaces: workspaceList,
  };
}
