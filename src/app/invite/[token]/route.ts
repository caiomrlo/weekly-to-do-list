import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/db";
import {
  workspaceInvites,
  workspaceMembers,
  workspaces,
  users,
} from "@/db/schema";
import { ACTIVE_WORKSPACE_COOKIE } from "@/lib/workspace";
import { and, eq } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  if (!token) {
    return NextResponse.redirect(
      new URL("/invite/error?reason=invalid", request.url)
    );
  }

  const session = await getSessionUser();

  // If unauthenticated, redirect to login preserving the invite target
  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", `/invite/${token}`);
    return NextResponse.redirect(loginUrl);
  }

  try {
    // Look up active invite record
    const [invite] = await db
      .select({
        id: workspaceInvites.id,
        workspaceId: workspaceInvites.workspaceId,
        role: workspaceInvites.role,
        status: workspaceInvites.status,
        expiresAt: workspaceInvites.expiresAt,
        workspaceName: workspaces.name,
      })
      .from(workspaceInvites)
      .innerJoin(workspaces, eq(workspaces.id, workspaceInvites.workspaceId))
      .where(
        and(
          eq(workspaceInvites.token, token),
          eq(workspaceInvites.status, "active")
        )
      )
      .limit(1);

    if (!invite) {
      return NextResponse.redirect(
        new URL("/invite/error?reason=invalid", request.url)
      );
    }

    // Verify expiration
    if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
      await db
        .update(workspaceInvites)
        .set({ status: "revoked", updatedAt: new Date() })
        .where(eq(workspaceInvites.id, invite.id));

      return NextResponse.redirect(
        new URL("/invite/error?reason=expired", request.url)
      );
    }

    // Check if user is already a member
    const [existingMember] = await db
      .select({ id: workspaceMembers.id })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, invite.workspaceId),
          eq(workspaceMembers.userId, session.userId)
        )
      )
      .limit(1);

    // If not a member, add to workspace_members
    if (!existingMember) {
      await db.insert(workspaceMembers).values({
        workspaceId: invite.workspaceId,
        userId: session.userId,
        role: invite.role || "member",
        joinedAt: new Date(),
      });
    }

    // Update user active workspace preference
    const [user] = await db
      .select({ preferences: users.preferences })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);

    await db
      .update(users)
      .set({
        preferences: {
          ...(user?.preferences || {}),
          activeWorkspaceId: invite.workspaceId,
        },
      })
      .where(eq(users.id, session.userId));

    // Redirect to home and switch active workspace cookie
    const homeUrl = new URL("/", request.url);
    const response = NextResponse.redirect(homeUrl);

    response.cookies.set(ACTIVE_WORKSPACE_COOKIE, invite.workspaceId, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });

    return response;
  } catch (err) {
    console.error("Error processing invite acceptance:", err);
    return NextResponse.redirect(
      new URL("/invite/error?reason=server_error", request.url)
    );
  }
}
