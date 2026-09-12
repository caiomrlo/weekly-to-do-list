import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import {
  getUserTagsAction,
  createTagAction,
  deleteTagAction,
} from "@/app/actions/tags";
import { db, cleanupTestUser } from "../setup/test-db";
import {
  createTestUser,
  loginAsTestUser,
  logoutTestUser,
  TestUserData,
} from "../setup/auth-helper";
import { tags } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

describe("Integration: Tags Actions", () => {
  let userA: TestUserData;
  let userB: TestUserData;

  beforeEach(async () => {
    vi.clearAllMocks();
    logoutTestUser();
  });

  afterAll(async () => {
    if (userA?.id) await cleanupTestUser(userA.id);
    if (userB?.id) await cleanupTestUser(userB.id);
  });

  describe("Authentication Guard", () => {
    it("should reject all tag actions when not authenticated", async () => {
      const getRes = await getUserTagsAction();
      expect(getRes.error).toBe("Not authenticated.");

      const createRes = await createTagAction({ name: "Bug" });
      expect(createRes.error).toBe("Not authenticated.");

      const deleteRes = await deleteTagAction("some-tag-id");
      expect(deleteRes.error).toBe("Not authenticated.");
    });
  });

  describe("createTagAction", () => {
    it("should reject empty tag name", async () => {
      userA = await createTestUser();
      await loginAsTestUser(userA);

      const res = await createTagAction({ name: "" });
      expect(res.error).toBe("Tag name cannot be empty.");
    });

    it("should reject tag names exceeding 50 characters", async () => {
      userA = await createTestUser();
      await loginAsTestUser(userA);

      const res = await createTagAction({ name: "T".repeat(51) });
      expect(res.error).toBe("Tag name must be at most 50 characters.");
    });

    it("should create a tag with default amber color if invalid color provided", async () => {
      userA = await createTestUser();
      await loginAsTestUser(userA);

      const res = await createTagAction({
        name: "Dev",
        color: "unknown-color",
      });

      expect(res.error).toBeUndefined();
      expect(res.tag?.name).toBe("Dev");
      expect(res.tag?.color).toBe("amber");
      expect(revalidatePath).toHaveBeenCalledWith("/");

      const [saved] = await db
        .select()
        .from(tags)
        .where(eq(tags.id, res.tag!.id));
      expect(saved.userId).toBe(userA.id);
    });

    it("should create a tag with specified valid color", async () => {
      userA = await createTestUser();
      await loginAsTestUser(userA);

      const res = await createTagAction({
        name: "Urgent",
        color: "rose",
      });

      expect(res.error).toBeUndefined();
      expect(res.tag?.name).toBe("Urgent");
      expect(res.tag?.color).toBe("rose");
    });
  });

  describe("getUserTagsAction & Multi-Tenant Isolation", () => {
    it("should list tags ordered by name and isolate between users", async () => {
      userA = await createTestUser();
      userB = await createTestUser();

      await loginAsTestUser(userA);
      await createTagAction({ name: "Testing", color: "indigo" });
      await createTagAction({ name: "Backend", color: "slate" });

      await loginAsTestUser(userB);
      await createTagAction({ name: "User B Tag", color: "emerald" });

      await loginAsTestUser(userA);
      const resA = await getUserTagsAction();
      expect(resA.error).toBeUndefined();
      expect(resA.tags?.length).toBe(2);
      expect(resA.tags?.[0].name).toBe("Backend");
      expect(resA.tags?.[1].name).toBe("Testing");
      expect(resA.tags?.some((t) => t.name.includes("User B"))).toBe(false);

      await loginAsTestUser(userB);
      const resB = await getUserTagsAction();
      expect(resB.error).toBeUndefined();
      expect(resB.tags?.length).toBe(1);
      expect(resB.tags?.[0].name).toBe("User B Tag");
    });
  });

  describe("deleteTagAction", () => {
    it("should delete tag only for the owning user", async () => {
      userA = await createTestUser();
      userB = await createTestUser();

      await loginAsTestUser(userA);
      const created = await createTagAction({ name: "To Delete" });
      const tagId = created.tag!.id;

      // User B tries to delete User A's tag
      await loginAsTestUser(userB);
      await deleteTagAction(tagId);

      // Verify User A's tag still exists
      const [stillExists] = await db
        .select()
        .from(tags)
        .where(eq(tags.id, tagId));
      expect(stillExists).toBeDefined();

      // User A deletes their own tag
      await loginAsTestUser(userA);
      const res = await deleteTagAction(tagId);
      expect(res.success).toBe(true);

      const [deleted] = await db
        .select()
        .from(tags)
        .where(eq(tags.id, tagId));
      expect(deleted).toBeUndefined();
    });
  });
});
