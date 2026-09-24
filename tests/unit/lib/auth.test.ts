import { describe, it, expect, vi, beforeEach } from "vitest";
import { getSessionUser, AUTH_COOKIE_NAME, auth, getAuthSecret } from "@/lib/auth";

describe("Better Auth configuration & session helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getAuthSecret", () => {
    it("should return BETTER_AUTH_SECRET when present", () => {
      const originalBetter = process.env.BETTER_AUTH_SECRET;
      const originalAuth = process.env.AUTH_SECRET;
      process.env.BETTER_AUTH_SECRET = "custom-better-secret";
      process.env.AUTH_SECRET = "custom-auth-secret";

      expect(getAuthSecret()).toBe("custom-better-secret");

      process.env.BETTER_AUTH_SECRET = originalBetter;
      process.env.AUTH_SECRET = originalAuth;
    });

    it("should fallback to AUTH_SECRET when BETTER_AUTH_SECRET is not present", () => {
      const originalBetter = process.env.BETTER_AUTH_SECRET;
      const originalAuth = process.env.AUTH_SECRET;
      delete process.env.BETTER_AUTH_SECRET;
      process.env.AUTH_SECRET = "legacy-auth-secret";

      expect(getAuthSecret()).toBe("legacy-auth-secret");

      process.env.BETTER_AUTH_SECRET = originalBetter;
      process.env.AUTH_SECRET = originalAuth;
    });

    it("should throw an error if no secret environment variable is provided", () => {
      const originalBetter = process.env.BETTER_AUTH_SECRET;
      const originalAuth = process.env.AUTH_SECRET;
      delete process.env.BETTER_AUTH_SECRET;
      delete process.env.AUTH_SECRET;

      expect(() => getAuthSecret()).toThrow(
        "Better Auth secret is missing. Please define BETTER_AUTH_SECRET or AUTH_SECRET in your environment variables."
      );

      process.env.BETTER_AUTH_SECRET = originalBetter;
      process.env.AUTH_SECRET = originalAuth;
    });

    it("should throw an error during module initialization when secrets are missing", async () => {
      vi.resetModules();
      const originalBetter = process.env.BETTER_AUTH_SECRET;
      const originalAuth = process.env.AUTH_SECRET;
      delete process.env.BETTER_AUTH_SECRET;
      delete process.env.AUTH_SECRET;

      try {
        await expect(import("@/lib/auth")).rejects.toThrow(
          "Better Auth secret is missing"
        );
      } finally {
        process.env.BETTER_AUTH_SECRET = originalBetter;
        process.env.AUTH_SECRET = originalAuth;
        vi.resetModules();
      }
    });
  });

  describe("constants & instance", () => {
    it("should export the correct Better Auth cookie name", () => {
      expect(AUTH_COOKIE_NAME).toBe("better-auth.session_token");
    });

    it("should export an initialized Better Auth instance with api endpoints", () => {
      expect(auth).toBeDefined();
      expect(typeof auth.api.getSession).toBe("function");
      expect(typeof auth.api.signInEmail).toBe("function");
      expect(typeof auth.api.signUpEmail).toBe("function");
      expect(typeof auth.api.signOut).toBe("function");
    });
  });

  describe("getSessionUser", () => {
    it("should extract userId and email from a valid session", async () => {
      const mockUser = {
        id: "user-uuid-1234",
        email: "user@example.com",
        name: "user",
        avatarColor: "indigo",
        createdAt: new Date(),
        updatedAt: new Date(),
        emailVerified: false,
      };

      const mockSession = {
        id: "session-1",
        token: "token-1",
        userId: mockUser.id,
        expiresAt: new Date(Date.now() + 100000),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const spy = vi
        .spyOn(auth.api, "getSession")
        .mockResolvedValueOnce({ user: mockUser, session: mockSession });

      const result = await getSessionUser();
      expect(result).not.toBeNull();
      expect(result?.userId).toBe("user-uuid-1234");
      expect(result?.email).toBe("user@example.com");
      expect(result?.avatarColor).toBe("indigo");

      spy.mockRestore();
    });

    it("should return null when auth.api.getSession resolves without a user", async () => {
      const spy = vi
        .spyOn(auth.api, "getSession")
        .mockResolvedValueOnce(null as unknown as Awaited<ReturnType<typeof auth.api.getSession>>);

      const result = await getSessionUser();
      expect(result).toBeNull();

      spy.mockRestore();
    });

    it("should return null when auth.api.getSession throws an exception", async () => {
      const spy = vi
        .spyOn(auth.api, "getSession")
        .mockRejectedValueOnce(new Error("Network or database failure"));

      const result = await getSessionUser();
      expect(result).toBeNull();

      spy.mockRestore();
    });
  });
});
