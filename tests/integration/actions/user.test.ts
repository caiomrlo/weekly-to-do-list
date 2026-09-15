import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import {
  getUserPreferencesAction,
  updateUserPreferencesAction,
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
});
