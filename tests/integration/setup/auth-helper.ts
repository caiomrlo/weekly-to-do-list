import { db } from "@/db";
import { users, DEFAULT_USER_PREFERENCES, UserPreferences } from "@/db/schema";
import { hashPassword, signToken, AUTH_COOKIE_NAME } from "@/lib/auth";
import { mockCookieStore } from "./mocks";
import { randomUUID } from "crypto";

export interface TestUserData {
  id: string;
  email: string;
  plainPassword: string;
  preferences: UserPreferences;
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
  const passwordHash = await hashPassword(plainPassword);
  const now = new Date();

  const [newUser] = await db
    .insert(users)
    .values({
      email,
      passwordHash,
      preferences: overrides?.preferences || DEFAULT_USER_PREFERENCES,
      createdAt: now,
      lastLoginAt: now,
    })
    .returning();

  return {
    id: newUser.id,
    email: newUser.email,
    plainPassword,
    preferences: newUser.preferences,
  };
}

/**
 * Signs a session JWT for the test user and writes it to the mock cookie store.
 */
export async function loginAsTestUser(user: {
  id: string;
  email: string;
}): Promise<string> {
  const token = await signToken({ userId: user.id, email: user.email });
  mockCookieStore.set(AUTH_COOKIE_NAME, token);
  return token;
}

/**
 * Clears the active authentication session from the mock cookie store.
 */
export function logoutTestUser(): void {
  mockCookieStore.delete(AUTH_COOKIE_NAME);
}

/**
 * Clears all cookies from the mock cookie store.
 */
export function clearAllCookies(): void {
  mockCookieStore.clear();
}
