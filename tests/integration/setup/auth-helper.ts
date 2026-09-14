import { db } from "@/db";
import {
  users,
  sessions,
  accounts,
  DEFAULT_USER_PREFERENCES,
  UserPreferences,
} from "@/db/schema";
import { AUTH_COOKIE_NAME } from "@/lib/auth";
import { mockCookieStore } from "./mocks";
import { randomUUID, createHmac } from "crypto";
import { hashPassword } from "better-auth/crypto";

export interface TestUserData {
  id: string;
  email: string;
  plainPassword: string;
  preferences: UserPreferences;
}

const AUTH_SECRET =
  process.env.BETTER_AUTH_SECRET ||
  process.env.AUTH_SECRET ||
  "weekly-todo-jwt-auth-super-secret-key-2026";

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

  return {
    id: newUser.id,
    email: newUser.email,
    plainPassword,
    preferences: newUser.preferences,
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
