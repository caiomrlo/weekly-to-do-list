import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import {
  getUserPreferencesAction,
  updateUserPreferencesAction,
  uploadUserAvatarAction,
  deleteUserAvatarAction,
} from "@/app/actions/user";
import { db, cleanupTestUser } from "../setup/test-db";
import {
  createTestUser,
  loginAsTestUser,
  logoutTestUser,
  TestUserData,
} from "../setup/auth-helper";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { uploadToR2, deleteFromR2 } from "@/lib/r2";

const VALID_PNG_BUFFER = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

describe("Integration: User Preferences Actions", () => {
  let testUser: TestUserData;

  beforeEach(async () => {
    vi.clearAllMocks();
    logoutTestUser();
  });

  afterAll(async () => {
    if (testUser?.id) {
      await cleanupTestUser(testUser.id);
    }
  });

  it("should return not authenticated error when session is absent", async () => {
    const getRes = await getUserPreferencesAction();
    expect(getRes.error).toBe("Not authenticated.");

    const updateRes = await updateUserPreferencesAction({ showSaturday: true });
    expect(updateRes.error).toBe("Not authenticated.");
  });

  it("should fetch user preferences accurately for logged-in user", async () => {
    testUser = await createTestUser({
      preferences: {
        showSaturday: false,
        showSunday: true,
        theme: "dark",
      },
    });
    await loginAsTestUser(testUser);

    const res = await getUserPreferencesAction();
    expect(res.error).toBeUndefined();
    expect(res.preferences).toMatchObject({
      showSaturday: false,
      showSunday: true,
      theme: "dark",
    });
  });

  it("should merge new preferences with existing preferences and persist in DB", async () => {
    testUser = await createTestUser({
      preferences: {
        showSaturday: false,
        showSunday: false,
        theme: "light",
      },
    });
    await loginAsTestUser(testUser);

    const updateRes = await updateUserPreferencesAction({
      showSaturday: true,
    });

    expect(updateRes.error).toBeUndefined();
    expect(updateRes.success).toBe(true);
    expect(updateRes.preferences?.showSaturday).toBe(true);
    expect(updateRes.preferences?.showSunday).toBe(false);
    expect(updateRes.preferences?.theme).toBe("light");
    expect(revalidatePath).toHaveBeenCalledWith("/");

    // Verify directly in DB
    const [saved] = await db
      .select({ preferences: users.preferences })
      .from(users)
      .where(eq(users.id, testUser.id));

    expect(saved.preferences).toMatchObject({
      showSaturday: true,
      showSunday: false,
      theme: "light",
    });
  });

  it("should successfully persist background theme preference", async () => {
    testUser = await createTestUser({
      preferences: {
        showSaturday: false,
        showSunday: false,
        theme: "light",
        background: "default",
      },
    });
    await loginAsTestUser(testUser);

    const updateRes = await updateUserPreferencesAction({
      background: "sunset",
    });

    expect(updateRes.error).toBeUndefined();
    expect(updateRes.success).toBe(true);
    expect(updateRes.preferences?.background).toBe("sunset");

    // Verify directly in DB
    const [saved] = await db
      .select({ preferences: users.preferences })
      .from(users)
      .where(eq(users.id, testUser.id));

    expect(saved.preferences?.background).toBe("sunset");
  });

  describe("uploadUserAvatarAction", () => {
    it("should reject when not authenticated", async () => {
      const formData = new FormData();
      const res = await uploadUserAvatarAction(formData);
      expect(res.error).toBe("Not authenticated.");
    });

    it("should reject when file is missing", async () => {
      testUser = await createTestUser();
      await loginAsTestUser(testUser);

      const formData = new FormData();
      const res = await uploadUserAvatarAction(formData);
      expect(res.error).toBe("No image file provided.");
    });

    it("should reject when file is not an allowed image format", async () => {
      testUser = await createTestUser();
      await loginAsTestUser(testUser);

      const formData = new FormData();
      const textFile = new File(["not an image"], "document.txt", {
        type: "text/plain",
      });
      formData.append("file", textFile);

      const res = await uploadUserAvatarAction(formData);
      expect(res.error).toContain("Unsupported format");
    });

    it("should optimize image to 150x150 webp, upload to R2, and save relative url to users.image", async () => {
      testUser = await createTestUser();
      await loginAsTestUser(testUser);

      const formData = new FormData();
      const imageFile = new File([VALID_PNG_BUFFER], "avatar.png", {
        type: "image/png",
      });
      formData.append("file", imageFile);

      const res = await uploadUserAvatarAction(formData);

      expect(res.error).toBeUndefined();
      expect(res.success).toBe(true);
      expect(res.imageUrl).toMatch(/^\/api\/avatar\/[a-f0-9-]{36}\.webp$/);

      // Verify uploadToR2 was called with avatars/<uuid>.webp
      expect(uploadToR2).toHaveBeenCalledTimes(1);
      const [uploadedKey, uploadedBuffer, contentType] = vi.mocked(uploadToR2).mock.calls[0];
      expect(uploadedKey).toMatch(/^avatars\/[a-f0-9-]{36}\.webp$/);
      expect(contentType).toBe("image/webp");
      expect(uploadedBuffer).toBeInstanceOf(Buffer);

      // Verify DB was updated
      const [dbUser] = await db
        .select({ image: users.image })
        .from(users)
        .where(eq(users.id, testUser.id));

      expect(dbUser.image).toBe(res.imageUrl);
      expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
    });

    it("should clean up prior avatar from R2 when uploading a new one", async () => {
      testUser = await createTestUser();
      await loginAsTestUser(testUser);

      const priorUuid = "11111111-2222-3333-4444-555555555555";
      await db
        .update(users)
        .set({ image: `/api/avatar/${priorUuid}.webp` })
        .where(eq(users.id, testUser.id));

      const formData = new FormData();
      const imageFile = new File([VALID_PNG_BUFFER], "new-photo.png", {
        type: "image/png",
      });
      formData.append("file", imageFile);

      const res = await uploadUserAvatarAction(formData);
      expect(res.success).toBe(true);

      // Verify deleteFromR2 was called for prior avatar
      expect(deleteFromR2).toHaveBeenCalledWith(`avatars/${priorUuid}.webp`);
    });
  });

  describe("deleteUserAvatarAction", () => {
    it("should reject when not authenticated", async () => {
      const res = await deleteUserAvatarAction();
      expect(res.error).toBe("Not authenticated.");
    });

    it("should delete existing avatar from R2 and set users.image to null", async () => {
      testUser = await createTestUser();
      await loginAsTestUser(testUser);

      const avatarUuid = "99999999-8888-7777-6666-555555555555";
      await db
        .update(users)
        .set({ image: `/api/avatar/${avatarUuid}.webp` })
        .where(eq(users.id, testUser.id));

      const res = await deleteUserAvatarAction();

      expect(res.error).toBeUndefined();
      expect(res.success).toBe(true);

      // Verify deleteFromR2 was called
      expect(deleteFromR2).toHaveBeenCalledWith(`avatars/${avatarUuid}.webp`);

      // Verify DB was reset
      const [dbUser] = await db
        .select({ image: users.image })
        .from(users)
        .where(eq(users.id, testUser.id));

      expect(dbUser.image).toBeNull();
      expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
    });
  });
});
