import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { registerAction, loginAction, logoutAction } from "@/app/actions/auth";
import { db, cleanupTestUser } from "../setup/test-db";
import { createTestUser, clearAllCookies } from "../setup/auth-helper";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { AUTH_COOKIE_NAME, verifyToken } from "@/lib/auth";
import { mockCookieStore } from "../setup/mocks";
import { redirect } from "next/navigation";
import { randomUUID } from "crypto";

describe("Integration: Auth Actions (registerAction, loginAction, logoutAction)", () => {
  const userIdsToCleanup: string[] = [];

  beforeEach(() => {
    clearAllCookies();
    vi.clearAllMocks();
  });

  afterAll(async () => {
    for (const id of userIdsToCleanup) {
      await cleanupTestUser(id);
    }
  });

  describe("registerAction", () => {
    it("should reject invalid email format", async () => {
      const res = await registerAction({
        email: "invalid-email-no-at",
        password: "ValidPassword123!",
      });

      expect(res.error).toBe("Please enter a valid email address.");
      expect(mockCookieStore.has(AUTH_COOKIE_NAME)).toBe(false);
    });

    it("should reject passwords shorter than 6 characters", async () => {
      const res = await registerAction({
        email: "test@example.com",
        password: "123",
      });

      expect(res.error).toBe("Password must be at least 6 characters.");
      expect(mockCookieStore.has(AUTH_COOKIE_NAME)).toBe(false);
    });

    it("should successfully register a new user, save to DB and set auth cookie", async () => {
      const uniqueEmail = `reg-${randomUUID().slice(0, 8)}@integration.test`;
      const res = await registerAction({
        email: uniqueEmail,
        password: "SecurePassword123!",
      });

      expect(res.error).toBeUndefined();
      expect(res.success).toBe(true);

      // Verify DB record
      const [saved] = await db
        .select()
        .from(users)
        .where(eq(users.email, uniqueEmail));

      expect(saved).toBeDefined();
      expect(saved.email).toBe(uniqueEmail);
      expect(saved.passwordHash).not.toBe("SecurePassword123!");
      expect(saved.passwordHash.startsWith("$2")).toBe(true);
      userIdsToCleanup.push(saved.id);

      // Verify session cookie
      const cookieObj = mockCookieStore.get(AUTH_COOKIE_NAME);
      expect(cookieObj).toBeDefined();
      expect(cookieObj?.value).toBeDefined();

      const decoded = await verifyToken(cookieObj!.value);
      expect(decoded?.userId).toBe(saved.id);
      expect(decoded?.email).toBe(uniqueEmail);
    });

    it("should reject registration if email is already registered", async () => {
      const existingUser = await createTestUser();
      userIdsToCleanup.push(existingUser.id);

      const res = await registerAction({
        email: existingUser.email,
        password: "AnotherPassword123!",
      });

      expect(res.error).toBe("This email is already registered. Please sign in.");
    });
  });

  describe("loginAction", () => {
    it("should reject empty email or password", async () => {
      const res = await loginAction({
        email: "",
        password: "",
      });

      expect(res.error).toBe("Please enter both email and password.");
    });

    it("should reject non-existent email", async () => {
      const res = await loginAction({
        email: "non-existent@integration.test",
        password: "SomePassword123!",
      });

      expect(res.error).toBe("Incorrect email or password.");
      expect(mockCookieStore.has(AUTH_COOKIE_NAME)).toBe(false);
    });

    it("should reject incorrect password for existing user", async () => {
      const testUser = await createTestUser({ password: "CorrectPassword123!" });
      userIdsToCleanup.push(testUser.id);

      const res = await loginAction({
        email: testUser.email,
        password: "WrongPassword456!",
      });

      expect(res.error).toBe("Incorrect email or password.");
      expect(mockCookieStore.has(AUTH_COOKIE_NAME)).toBe(false);
    });

    it("should authenticate successfully with correct credentials and update lastLoginAt", async () => {
      const testUser = await createTestUser({ password: "MyPassword123!" });
      userIdsToCleanup.push(testUser.id);

      const beforeLogin = new Date();
      const res = await loginAction({
        email: testUser.email,
        password: "MyPassword123!",
      });

      expect(res.error).toBeUndefined();
      expect(res.success).toBe(true);

      // Verify cookie was set
      const cookieObj = mockCookieStore.get(AUTH_COOKIE_NAME);
      expect(cookieObj).toBeDefined();
      const decoded = await verifyToken(cookieObj!.value);
      expect(decoded?.userId).toBe(testUser.id);

      // Verify lastLoginAt updated in DB
      const [updatedUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, testUser.id));
      expect(updatedUser.lastLoginAt).toBeDefined();
      expect(new Date(updatedUser.lastLoginAt!).getTime()).toBeGreaterThanOrEqual(
        beforeLogin.getTime() - 1000
      );
    });
  });

  describe("logoutAction", () => {
    it("should remove session cookie and redirect to /login", async () => {
      const testUser = await createTestUser();
      userIdsToCleanup.push(testUser.id);

      // Set cookie first
      await loginAction({
        email: testUser.email,
        password: testUser.plainPassword,
      });
      expect(mockCookieStore.has(AUTH_COOKIE_NAME)).toBe(true);

      await logoutAction();

      expect(mockCookieStore.has(AUTH_COOKIE_NAME)).toBe(false);
      expect(redirect).toHaveBeenCalledWith("/login");
    });
  });
});
