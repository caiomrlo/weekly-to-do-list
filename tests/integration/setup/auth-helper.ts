import { db } from "@/db";
import {
  users,
  sessions,
  accounts,
  workspaces,
  workspaceMembers,
  DEFAULT_USER_PREFERENCES,
  UserPreferences,
} from "@/db/schema";
import { AUTH_COOKIE_NAME, getAuthSecret } from "@/lib/auth";
import {
  ACTIVE_WORKSPACE_COOKIE,
  getActiveWorkspaceContext,
} from "@/lib/workspace";
import { eq } from "drizzle-orm";
import { mockCookieStore } from "./mocks";
import { randomUUID, createHmac } from "crypto";
import { hashPassword } from "better-auth/crypto";

export interface TestUserData {
  id: string;
  email: string;
  plainPassword: string;
  preferences: UserPreferences;
}

const AUTH_SECRET = getAuthSecret();

function signCookieValue(value: string, secret: string): string {
  const signature = createHmac("sha256", secret).update(value).digest("base64");
  return `${value}.${signature}`;
}

/**
 * Creates a unique test user in the database.
 */
export async function createTestUser(overrides?: {
  email?: string;
  password?: string;
  preferences?: UserPreferences;
}): Promise<TestUserData> {
  const email =
    overrides?.email || `test-${randomUUID().slice(0, 8)}@integration.test`;
  const plainPassword = overrides?.password || "TestSecret123!";
  const now = new Date();

  const [newUser] = await db
    .insert(users)
    .values({
      name: email.split("@")[0],
      email,
      emailVerified: false,
      preferences: overrides?.preferences || DEFAULT_USER_PREFERENCES,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
    })
    .returning();

  const hashedPassword = await hashPassword(plainPassword);

  await db.insert(accounts).values({
    id: randomUUID(),
    accountId: newUser.id,
    providerId: "credential",
    userId: newUser.id,
    password: hashedPassword,
    createdAt: now,
    updatedAt: now,
  });

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

  const updatedPrefs: UserPreferences = {
    ...(newUser.preferences || DEFAULT_USER_PREFERENCES),
    activeWorkspaceId: defaultWorkspace.id,
  };

  await db
    .update(users)
    .set({ preferences: updatedPrefs })
    .where(eq(users.id, newUser.id));

  return {
    id: newUser.id,
    email: newUser.email,
    plainPassword,
    preferences: updatedPrefs,
  };
}

/**
 * Creates an active session for the test user and writes the signed session cookie to mockCookieStore.
 */
export async function loginAsTestUser(user: {
  id: string;
  email: string;
}): Promise<string> {
  const token = randomUUID();
  const now = new Date();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

  await db.insert(sessions).values({
    id: randomUUID(),
    token,
    userId: user.id,
    expiresAt,
    createdAt: now,
    updatedAt: now,
  });

  const signedCookie = signCookieValue(token, AUTH_SECRET);
  mockCookieStore.set(AUTH_COOKIE_NAME, signedCookie);

  const { activeWorkspace } = await getActiveWorkspaceContext(user.id);
  mockCookieStore.set(ACTIVE_WORKSPACE_COOKIE, activeWorkspace.id);

  return token;
}

/**
 * Clears the active authentication session from the mock cookie store.
 */
export function logoutTestUser(): void {
  mockCookieStore.delete(AUTH_COOKIE_NAME);
  mockCookieStore.delete(ACTIVE_WORKSPACE_COOKIE);
}

/**
 * Clears all cookies from the mock cookie store.
 */
export function clearAllCookies(): void {
  mockCookieStore.clear();
}
