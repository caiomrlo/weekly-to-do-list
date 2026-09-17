import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { DEFAULT_USER_PREFERENCES } from "@/db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    usePlural: true,
    schema: {
      users: schema.users,
      sessions: schema.sessions,
      accounts: schema.accounts,
      verifications: schema.verifications,
    },
  }),
  secret:
    process.env.BETTER_AUTH_SECRET ||
    process.env.AUTH_SECRET ||
    "weekly-todo-jwt-auth-super-secret-key-2026",
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 6,
  },
  user: {
    additionalFields: {
      preferences: {
        type: "json",
        defaultValue: DEFAULT_USER_PREFERENCES,
        required: false,
      },
      lastLoginAt: {
        type: "date",
        required: false,
      },
      avatarColor: {
        type: "string",
        required: false,
      },
    },
  },
  advanced: {
    database: {
      generateId: "uuid",
    },
  },
  plugins: [nextCookies()],
});

export const AUTH_COOKIE_NAME = "better-auth.session_token";

export interface SessionPayload {
  userId: string;
  email: string;
  name?: string;
  image?: string | null;
  avatarColor?: string | null;
}

export async function getSessionUser(): Promise<SessionPayload | null> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return null;
    }

    return {
      userId: session.user.id,
      email: session.user.email,
      name: session.user.name,
      image: session.user.image,
      avatarColor:
        (session.user as { avatarColor?: string | null }).avatarColor || null,
    };
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "digest" in err &&
      (err as { digest?: string }).digest === "DYNAMIC_SERVER_USAGE"
    ) {
      throw err;
    }
    console.error("Error retrieving session in getSessionUser:", err);
    return null;
  }
}
