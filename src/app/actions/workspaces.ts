"use server";

import { db } from "@/db";
import {
  workspaces,
  workspaceMembers,
  users,
  Workspace,
  DEFAULT_USER_PREFERENCES,
} from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import {
  ACTIVE_WORKSPACE_COOKIE,
  getActiveWorkspaceContext,
} from "@/lib/workspace";
import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

export interface WorkspaceResponse {
  workspaces?: Workspace[];
  activeWorkspaceId?: string;
  workspace?: Workspace;
  nextActiveWorkspaceId?: string;
  success?: boolean;
  error?: string;
}

/**
 * Retrieves all workspaces accessible to the authenticated user along with the active workspace ID.
 */
export async function getUserWorkspacesAction(): Promise<WorkspaceResponse> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  try {
    const { activeWorkspace, workspaces: userWorkspaces } =
      await getActiveWorkspaceContext(session.userId);

    return {
      workspaces: userWorkspaces,
      activeWorkspaceId: activeWorkspace.id,
    };
  } catch (err: unknown) {
    console.error("Error fetching user workspaces:", err);
    return { error: "Failed to fetch workspaces." };
  }
}

/**
 * Creates a new isolated workspace and immediately switches to it.
 */
export async function createWorkspaceAction(data: {
  name: string;
}): Promise<WorkspaceResponse> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  const name = data.name.trim();
  if (!name) {
    return { error: "Workspace name cannot be empty." };
  }
  if (name.length > 100) {
    return { error: "Workspace name must be at most 100 characters." };
  }

  try {
    const now = new Date();
    const [newWorkspace] = await db
      .insert(workspaces)
      .values({
        name,
        ownerId: session.userId,
        isDefault: false,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    await db.insert(workspaceMembers).values({
      workspaceId: newWorkspace.id,
      userId: session.userId,
      role: "owner",
      joinedAt: now,
    });

    // Switch active workspace in cookie and preferences
    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_WORKSPACE_COOKIE, newWorkspace.id, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });

    const [user] = await db
      .select({ preferences: users.preferences })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);

    await db
      .update(users)
      .set({
        preferences: {
          ...(user?.preferences || DEFAULT_USER_PREFERENCES),
          activeWorkspaceId: newWorkspace.id,
        },
      })
      .where(eq(users.id, session.userId));

    revalidatePath("/", "layout");
    revalidatePath("/");
    revalidatePath("/docs");

    return {
      success: true,
      workspace: newWorkspace,
      activeWorkspaceId: newWorkspace.id,
    };
  } catch (err: unknown) {
    console.error("Error creating workspace:", err);
    return { error: "Failed to create workspace." };
  }
}

/**
 * Renames an existing workspace.
 */
export async function renameWorkspaceAction(
  workspaceId: string,
  name: string
): Promise<WorkspaceResponse> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  const trimmedName = name.trim();
  if (!trimmedName) {
    return { error: "Workspace name cannot be empty." };
  }
  if (trimmedName.length > 100) {
    return { error: "Workspace name must be at most 100 characters." };
  }

  try {
    // Verify membership & permissions
    const [member] = await db
      .select()
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, session.userId)
        )
      )
      .limit(1);

    if (!member) {
      return { error: "Workspace not found or permission denied." };
    }

    const [updatedWorkspace] = await db
      .update(workspaces)
      .set({
        name: trimmedName,
        updatedAt: new Date(),
      })
      .where(eq(workspaces.id, workspaceId))
      .returning();

    revalidatePath("/", "layout");
    revalidatePath("/");
    revalidatePath("/docs");

    return { success: true, workspace: updatedWorkspace };
  } catch (err: unknown) {
    console.error("Error renaming workspace:", err);
    return { error: "Failed to rename workspace." };
  }
}

/**
 * Deletes a workspace with cascading deletion of all associated data.
 * Protected: default workspace cannot be deleted.
 */
export async function deleteWorkspaceAction(
  workspaceId: string
): Promise<WorkspaceResponse> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  try {
    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);

    if (!workspace) {
      return { error: "Workspace not found." };
    }

    // Verify ownership
    if (workspace.ownerId !== session.userId) {
      return { error: "Only the workspace owner can delete this workspace." };
    }

    // Strict protection: do not allow deleting default workspace
    if (workspace.isDefault) {
      return { error: "The default workspace cannot be deleted." };
    }

    // Also check total workspace count for user
    const memberWorkspaces = await db
      .select({ workspace: workspaces })
      .from(workspaces)
      .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
      .where(eq(workspaceMembers.userId, session.userId));

    if (memberWorkspaces.length <= 1) {
      return { error: "Cannot delete the only remaining workspace." };
    }

    // Delete workspace (foreign keys cascade to tasks, projects, tags, docs, recurring_rules, members)
    await db.delete(workspaces).where(eq(workspaces.id, workspaceId));

    // Find the next active workspace (default workspace or first remaining)
    const remaining = memberWorkspaces
      .map((r) => r.workspace)
      .filter((w) => w.id !== workspaceId);
    const nextActiveWorkspace =
      remaining.find((w) => w.isDefault) || remaining[0];

    // Update active cookie and user preference
    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_WORKSPACE_COOKIE, nextActiveWorkspace.id, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });

    const [user] = await db
      .select({ preferences: users.preferences })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);

    await db
      .update(users)
      .set({
        preferences: {
          ...(user?.preferences || DEFAULT_USER_PREFERENCES),
          activeWorkspaceId: nextActiveWorkspace.id,
        },
      })
      .where(eq(users.id, session.userId));

    revalidatePath("/", "layout");
    revalidatePath("/");
    revalidatePath("/docs");

    return {
      success: true,
      nextActiveWorkspaceId: nextActiveWorkspace.id,
    };
  } catch (err: unknown) {
    console.error("Error deleting workspace:", err);
    return { error: "Failed to delete workspace." };
  }
}

/**
 * Switches the active workspace, updating both cookie and user preference.
 */
export async function switchWorkspaceAction(
  workspaceId: string
): Promise<WorkspaceResponse> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  try {
    const [member] = await db
      .select()
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, session.userId)
        )
      )
      .limit(1);

    if (!member) {
      return { error: "Access denied to this workspace." };
    }

    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_WORKSPACE_COOKIE, workspaceId, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });

    const [user] = await db
      .select({ preferences: users.preferences })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);

    await db
      .update(users)
      .set({
        preferences: {
          ...(user?.preferences || DEFAULT_USER_PREFERENCES),
          activeWorkspaceId: workspaceId,
        },
      })
      .where(eq(users.id, session.userId));

    revalidatePath("/", "layout");
    revalidatePath("/");
    revalidatePath("/docs");

    return { success: true, activeWorkspaceId: workspaceId };
  } catch (err: unknown) {
    console.error("Error switching workspace:", err);
    return { error: "Failed to switch workspace." };
  }
}
