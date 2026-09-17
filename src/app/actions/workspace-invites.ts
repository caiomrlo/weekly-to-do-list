"use server";

import { db } from "@/db";
import {
  workspaces,
  workspaceMembers,
  workspaceInvites,
  users,
} from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { and, eq, isNull, desc, asc } from "drizzle-orm";
import crypto from "node:crypto";

export interface WorkspaceInviteLinkResponse {
  enabled?: boolean;
  token?: string;
  role?: string;
  success?: boolean;
  error?: string;
}

export interface WorkspaceMemberItem {
  id: string;
  userId: string;
  name: string;
  email: string;
  image?: string | null;
  avatarColor?: string | null;
  role: string;
  isOwner: boolean;
  isCurrentUser: boolean;
  joinedAt: Date;
}

export interface WorkspaceMembersResponse {
  members?: WorkspaceMemberItem[];
  workspaceName?: string;
  isOwner?: boolean;
  error?: string;
}

/**
 * Checks if the authenticated user has access to the specified workspace.
 */
async function verifyWorkspaceMembership(workspaceId: string, userId: string) {
  const [member] = await db
    .select({
      id: workspaceMembers.id,
      role: workspaceMembers.role,
      ownerId: workspaces.ownerId,
      workspaceName: workspaces.name,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, userId)
      )
    )
    .limit(1);

  return member || null;
}

/**
 * Retrieves the current shareable invite link state for a workspace.
 */
export async function getWorkspaceInviteLinkAction(
  workspaceId: string
): Promise<WorkspaceInviteLinkResponse> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  try {
    const membership = await verifyWorkspaceMembership(workspaceId, session.userId);
    if (!membership) {
      return { error: "Access denied to this workspace." };
    }

    const [invite] = await db
      .select()
      .from(workspaceInvites)
      .where(
        and(
          eq(workspaceInvites.workspaceId, workspaceId),
          isNull(workspaceInvites.email),
          eq(workspaceInvites.status, "active")
        )
      )
      .orderBy(desc(workspaceInvites.createdAt))
      .limit(1);

    if (!invite) {
      return { enabled: false };
    }

    // Check expiration if set
    if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
      await db
        .update(workspaceInvites)
        .set({ status: "revoked", updatedAt: new Date() })
        .where(eq(workspaceInvites.id, invite.id));
      return { enabled: false };
    }

    return {
      enabled: true,
      token: invite.token,
      role: invite.role,
    };
  } catch (err: unknown) {
    console.error("Error retrieving workspace invite link:", err);
    return { error: "Failed to retrieve invite link." };
  }
}

/**
 * Enables or disables the shareable invite link for a workspace.
 */
export async function toggleWorkspaceInviteLinkAction(
  workspaceId: string,
  enable: boolean
): Promise<WorkspaceInviteLinkResponse> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  try {
    const membership = await verifyWorkspaceMembership(workspaceId, session.userId);
    if (!membership) {
      return { error: "Access denied to this workspace." };
    }

    const now = new Date();

    if (enable) {
      // Find if an active invite link already exists
      const [existing] = await db
        .select()
        .from(workspaceInvites)
        .where(
          and(
            eq(workspaceInvites.workspaceId, workspaceId),
            isNull(workspaceInvites.email),
            eq(workspaceInvites.status, "active")
          )
        )
        .limit(1);

      if (existing) {
        return {
          success: true,
          enabled: true,
          token: existing.token,
          role: existing.role,
        };
      }

      // Generate a cryptographically secure 32-character hex token
      const token = crypto.randomBytes(16).toString("hex");

      const [newInvite] = await db
        .insert(workspaceInvites)
        .values({
          workspaceId,
          invitedBy: session.userId,
          token,
          email: null,
          role: "member",
          status: "active",
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      return {
        success: true,
        enabled: true,
        token: newInvite.token,
        role: newInvite.role,
      };
    } else {
      // Revoke all active public invite links for this workspace
      await db
        .update(workspaceInvites)
        .set({
          status: "revoked",
          updatedAt: now,
        })
        .where(
          and(
            eq(workspaceInvites.workspaceId, workspaceId),
            isNull(workspaceInvites.email),
            eq(workspaceInvites.status, "active")
          )
        );

      return {
        success: true,
        enabled: false,
      };
    }
  } catch (err: unknown) {
    console.error("Error toggling workspace invite link:", err);
    return { error: "Failed to update invite link settings." };
  }
}

/**
 * Regenerates the shareable invite link, invalidating any previously shared public link.
 */
export async function regenerateWorkspaceInviteLinkAction(
  workspaceId: string
): Promise<WorkspaceInviteLinkResponse> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  try {
    const membership = await verifyWorkspaceMembership(workspaceId, session.userId);
    if (!membership) {
      return { error: "Access denied to this workspace." };
    }

    const now = new Date();

    // Revoke existing public link invites
    await db
      .update(workspaceInvites)
      .set({
        status: "revoked",
        updatedAt: now,
      })
      .where(
        and(
          eq(workspaceInvites.workspaceId, workspaceId),
          isNull(workspaceInvites.email),
          eq(workspaceInvites.status, "active")
        )
      );

    // Create fresh invite token
    const token = crypto.randomBytes(16).toString("hex");

    const [newInvite] = await db
      .insert(workspaceInvites)
      .values({
        workspaceId,
        invitedBy: session.userId,
        token,
        email: null,
        role: "member",
        status: "active",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return {
      success: true,
      enabled: true,
      token: newInvite.token,
      role: newInvite.role,
    };
  } catch (err: unknown) {
    console.error("Error regenerating workspace invite link:", err);
    return { error: "Failed to regenerate invite link." };
  }
}

/**
 * Retrieves all members of the active workspace with real user profile details.
 */
export async function getWorkspaceMembersAction(
  workspaceId: string
): Promise<WorkspaceMembersResponse> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  try {
    const membership = await verifyWorkspaceMembership(workspaceId, session.userId);
    if (!membership) {
      return { error: "Access denied to this workspace." };
    }

    const memberRows = await db
      .select({
        memberId: workspaceMembers.id,
        userId: workspaceMembers.userId,
        role: workspaceMembers.role,
        joinedAt: workspaceMembers.joinedAt,
        name: users.name,
        email: users.email,
        image: users.image,
        avatarColor: users.avatarColor,
        ownerId: workspaces.ownerId,
        workspaceName: workspaces.name,
      })
      .from(workspaceMembers)
      .innerJoin(users, eq(users.id, workspaceMembers.userId))
      .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
      .where(eq(workspaceMembers.workspaceId, workspaceId))
      .orderBy(asc(workspaceMembers.joinedAt));

    const members: WorkspaceMemberItem[] = memberRows.map((r) => ({
      id: r.memberId,
      userId: r.userId,
      name: r.name || r.email.split("@")[0],
      email: r.email,
      image: r.image,
      avatarColor: r.avatarColor,
      role: r.role,
      isOwner: r.userId === r.ownerId,
      isCurrentUser: r.userId === session.userId,
      joinedAt: r.joinedAt,
    }));

    // Sort so owner and current user are prominent
    members.sort((a, b) => {
      if (a.isOwner && !b.isOwner) return -1;
      if (!a.isOwner && b.isOwner) return 1;
      return 0;
    });

    return {
      members,
      workspaceName: membership.workspaceName,
      isOwner: membership.ownerId === session.userId,
    };
  } catch (err: unknown) {
    console.error("Error retrieving workspace members:", err);
    return { error: "Failed to retrieve workspace members." };
  }
}
