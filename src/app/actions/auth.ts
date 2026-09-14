"use server";

import { db } from "@/db";
import { users } from "@/db/schema";
import { auth, AUTH_COOKIE_NAME } from "@/lib/auth";
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
  email: string;
  password: string;
}): Promise<AuthResponse> {
  const email = formData.email?.trim().toLowerCase();
  const password = formData.password;

  if (!email || !email.includes("@")) {
    return { error: "Please enter a valid email address." };
  }

  if (!password || password.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }

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
        name: email.split("@")[0],
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
  } catch (err) {
    console.error("Error during logout:", err);
  }
  redirect("/login");
}
