"use server";

import { db } from "@/db";
import { users, workspaces, workspaceMembers } from "@/db/schema";
import { auth, AUTH_COOKIE_NAME } from "@/lib/auth";
import { getRandomAvatarColor } from "@/lib/avatar-utils";
import {
  ACTIVE_WORKSPACE_COOKIE,
  getActiveWorkspaceContext,
} from "@/lib/workspace";
import { eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { parseSetCookieHeader } from "better-auth/cookies";

export interface AuthResponse {
  success?: boolean;
  error?: string;
}

async function applyResponseCookies(response: Response): Promise<void> {
  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) return;

  const cookieStore = await cookies();
  const parsed = parseSetCookieHeader(setCookie);

  for (const [name, cookieData] of parsed.entries()) {
    const maxAge =
      typeof cookieData.maxAge === "number"
        ? cookieData.maxAge
        : typeof cookieData.maxAge === "string"
          ? parseInt(cookieData.maxAge, 10)
          : undefined;

    if (maxAge === 0) {
      cookieStore.delete(name);
    } else {
      cookieStore.set(name, cookieData.value, {
        path: cookieData.path || "/",
        httpOnly: Boolean(cookieData.httpOnly),
        secure: typeof cookieData.secure === "boolean" ? cookieData.secure : undefined,
        sameSite: cookieData.sameSite as "lax" | "strict" | "none" | undefined,
        maxAge: Number.isFinite(maxAge) ? maxAge : undefined,
        expires: cookieData.expires instanceof Date ? cookieData.expires : undefined,
      });
    }
  }
}

export async function registerAction(formData: {
  name?: string;
  email: string;
  password: string;
}): Promise<AuthResponse> {
  const name = formData.name?.trim() || "";
  const email = formData.email?.trim().toLowerCase();
  const password = formData.password;

  if (!email || !email.includes("@")) {
    return { error: "Please enter a valid email address." };
  }

  if (!password || password.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }

  const displayName = name.length > 0 ? name : email.split("@")[0];

  try {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing.length > 0) {
      return { error: "This email is already registered. Please sign in." };
    }

    const res = await auth.api.signUpEmail({
      body: {
        email,
        password,
        name: displayName,
      },
      headers: await headers(),
      asResponse: true,
    });

    if (res instanceof Response && !res.ok) {
      const data = (await res.json().catch(() => ({}))) as { message?: string; code?: string };
      if (data?.message?.toLowerCase().includes("already") || data?.code === "USER_ALREADY_EXISTS") {
        return { error: "This email is already registered. Please sign in." };
      }
      return { error: data?.message || "An error occurred while creating your account. Please try again." };
    }

    if (res instanceof Response) {
      await applyResponseCookies(res);
    }

    const [newUser] = await db
      .select({ id: users.id, preferences: users.preferences })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (newUser) {
      const now = new Date();
      const [defaultWorkspace] = await db
        .insert(workspaces)
        .values({
          name: "My Workspace",
          ownerId: newUser.id,
          isDefault: true,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      await db.insert(workspaceMembers).values({
        workspaceId: defaultWorkspace.id,
        userId: newUser.id,
        role: "owner",
        joinedAt: now,
      });

      const randomColor = getRandomAvatarColor();

      await db
        .update(users)
        .set({
          name: displayName,
          avatarColor: randomColor,
          preferences: {
            ...(newUser.preferences || {}),
            activeWorkspaceId: defaultWorkspace.id,
          },
        })
        .where(eq(users.id, newUser.id));

      const cookieStore = await cookies();
      cookieStore.set(ACTIVE_WORKSPACE_COOKIE, defaultWorkspace.id, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
      });
    }

    return { success: true };
  } catch (err: unknown) {
    const errorObj = err as { message?: string; body?: { message?: string; code?: string } };
    const msg = errorObj?.body?.message || errorObj?.message || "";
    if (msg.toLowerCase().includes("already") || errorObj?.body?.code === "USER_ALREADY_EXISTS") {
      return { error: "This email is already registered. Please sign in." };
    }
    console.error("Error during registration:", err);
    return { error: "An error occurred while creating your account. Please try again." };
  }
}

export async function loginAction(formData: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  const email = formData.email?.trim().toLowerCase();
  const password = formData.password;

  if (!email || !password) {
    return { error: "Please enter both email and password." };
  }

  try {
    const res = await auth.api.signInEmail({
      body: {
        email,
        password,
      },
      headers: await headers(),
      asResponse: true,
    });

    if (res instanceof Response && !res.ok) {
      return { error: "Incorrect email or password." };
    }

    if (res instanceof Response) {
      await applyResponseCookies(res);
    }

    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.email, email));

    const [user] = await db
      .select({ id: users.id, avatarColor: users.avatarColor })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (user) {
      if (!user.avatarColor) {
        const randomColor = getRandomAvatarColor();
        await db
          .update(users)
          .set({ avatarColor: randomColor })
          .where(eq(users.id, user.id));
      }

      const { activeWorkspace } = await getActiveWorkspaceContext(user.id);
      const cookieStore = await cookies();
      cookieStore.set(ACTIVE_WORKSPACE_COOKIE, activeWorkspace.id, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
      });
    }

    return { success: true };
  } catch (err: unknown) {
    const errorObj = err as { message?: string; status?: number; body?: { message?: string; code?: string } };
    const msg = errorObj?.body?.message || errorObj?.message || "";
    if (
      msg.toLowerCase().includes("invalid") ||
      msg.toLowerCase().includes("credential") ||
      msg.toLowerCase().includes("password") ||
      errorObj?.status === 400 ||
      errorObj?.status === 401
    ) {
      return { error: "Incorrect email or password." };
    }
    console.error("Error during login:", err);
    return { error: "An error occurred while signing in. Please try again." };
  }
}

export async function logoutAction(): Promise<void> {
  try {
    const res = await auth.api.signOut({
      headers: await headers(),
      asResponse: true,
    });

    if (res instanceof Response) {
      await applyResponseCookies(res);
    }

    const cookieStore = await cookies();
    cookieStore.delete(AUTH_COOKIE_NAME);
    cookieStore.delete(ACTIVE_WORKSPACE_COOKIE);
  } catch (err) {
    console.error("Error during logout:", err);
  }
  redirect("/login");
}
