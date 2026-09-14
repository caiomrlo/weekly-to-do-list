import { describe, it, expect, vi, beforeEach } from "vitest";
import { getSessionUser, AUTH_COOKIE_NAME, auth } from "@/lib/auth";

describe("Better Auth configuration & session helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
