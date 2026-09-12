import { describe, it, expect } from "vitest";
import {
  hashPassword,
  comparePassword,
  signToken,
  verifyToken,
} from "@/lib/auth";

describe("auth cryptography & token utils", () => {
  describe("password hashing", () => {
    it("should hash passwords using bcrypt and verify correctly", async () => {
      const plain = "SecretPassword123!";
      const hash = await hashPassword(plain);

      expect(hash).not.toBe(plain);
      expect(hash.startsWith("$2")).toBe(true);

      const isValid = await comparePassword(plain, hash);
      expect(isValid).toBe(true);
    });

    it("should reject incorrect passwords against hash", async () => {
      const plain = "SecretPassword123!";
      const wrong = "WrongPassword456!";
      const hash = await hashPassword(plain);

      const isValid = await comparePassword(wrong, hash);
      expect(isValid).toBe(false);
    });

    it("should generate distinct salt hashes for the same password", async () => {
      const plain = "CommonPassword99";
      const hash1 = await hashPassword(plain);
      const hash2 = await hashPassword(plain);

      expect(hash1).not.toBe(hash2);
      expect(await comparePassword(plain, hash1)).toBe(true);
      expect(await comparePassword(plain, hash2)).toBe(true);
    });
  });

  describe("jwt tokens", () => {
    it("should sign a valid JWT and decode the exact session payload", async () => {
      const payload = {
        userId: "user-uuid-1234",
        email: "developer@example.com",
      };

      const token = await signToken(payload);
      expect(typeof token).toBe("string");
      expect(token.split(".").length).toBe(3);

      const verified = await verifyToken(token);
      expect(verified).not.toBeNull();
      expect(verified?.userId).toBe(payload.userId);
      expect(verified?.email).toBe(payload.email);
    });

    it("should return null when verifying a malformed token string", async () => {
      const verified = await verifyToken("malformed.jwt.token");
      expect(verified).toBeNull();
    });

    it("should return null when verifying a tampered token signature", async () => {
      const payload = {
        userId: "user-uuid-1234",
        email: "developer@example.com",
      };
      const token = await signToken(payload);
      const parts = token.split(".");
      // Tamper payload segment
      const tamperedToken = `${parts[0]}.eyJob2dndXJ1Ijoicm9vdCJ9.${parts[2]}`;

      const verified = await verifyToken(tamperedToken);
      expect(verified).toBeNull();
    });
  });
});
