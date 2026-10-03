import { describe, it, expect, afterAll, beforeEach } from "vitest";
import { db, cleanupTestUser } from "../setup/test-db";
import {
  createTestUser,
  loginAsTestUser,
  logoutTestUser,
  TestUserData,
} from "../setup/auth-helper";
import {
  savePushSubscriptionAction,
  deletePushSubscriptionAction,
  updateNotificationPreferencesAction,
  getVapidPublicKeyAction,
} from "@/app/actions/notifications";
import { pushSubscriptions, notificationLogs, users, tasks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { dispatchNotifications } from "@/lib/notifications/dispatcher";

describe("Integration: Push Notifications & Idempotency", () => {
  let testUser: TestUserData;

  afterAll(async () => {
    logoutTestUser();
    if (testUser?.id) {
      await cleanupTestUser(testUser.id);
    }
  });

  beforeEach(async () => {
    logoutTestUser();
    if (testUser?.id) {
      await cleanupTestUser(testUser.id);
    }
    testUser = await createTestUser();
    await loginAsTestUser(testUser);
  });

  it("should return VAPID public key dynamically for authenticated user", async () => {
    const res = await getVapidPublicKeyAction();
    expect(res.publicKey).toBeDefined();
    expect(typeof res.publicKey).toBe("string");

    // When logged out, should reject
    logoutTestUser();
    const unauthRes = await getVapidPublicKeyAction();
    expect(unauthRes.error).toBe("Not authenticated.");
  });

  it("should save and update push subscription for authenticated user", async () => {
    const endpoint = `https://fcm.googleapis.com/fcm/send/test-sub-${Date.now()}`;
    const p256dh = "test-p256dh-key";
    const auth = "test-auth-secret";

    const saveRes = await savePushSubscriptionAction({
      endpoint,
      keys: { p256dh, auth },
      userAgent: "Vitest Test Agent",
    });

    expect(saveRes.success).toBe(true);

    const [saved] = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, endpoint));

    expect(saved).toBeDefined();
    expect(saved.userId).toBe(testUser.id);
    expect(saved.p256dh).toBe(p256dh);
    expect(saved.auth).toBe(auth);
    expect(saved.userAgent).toBe("Vitest Test Agent");

    // Updating same endpoint should update credentials instead of inserting duplicate
    const updatedP256dh = "updated-p256dh-key";
    const updateRes = await savePushSubscriptionAction({
      endpoint,
      keys: { p256dh: updatedP256dh, auth },
      userAgent: "Vitest Updated Agent",
    });

    expect(updateRes.success).toBe(true);

    const subs = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, endpoint));

    expect(subs).toHaveLength(1);
    expect(subs[0].p256dh).toBe(updatedP256dh);
    expect(subs[0].userAgent).toBe("Vitest Updated Agent");
  });

  it("should delete push subscription on unsubscribe", async () => {
    const endpoint = `https://fcm.googleapis.com/fcm/send/delete-test-${Date.now()}`;
    await savePushSubscriptionAction({
      endpoint,
      keys: { p256dh: "k", auth: "a" },
    });

    const deleteRes = await deletePushSubscriptionAction(endpoint);
    expect(deleteRes.success).toBe(true);

    const [check] = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, endpoint));

    expect(check).toBeUndefined();
  });

  it("should update notification preferences properly", async () => {
    const updateRes = await updateNotificationPreferencesAction({
      morningDaily: false,
      morningHour: 9,
      reminderMinutesBefore: 30,
    });

    expect(updateRes.success).toBe(true);
    expect(updateRes.preferences?.morningDaily).toBe(false);
    expect(updateRes.preferences?.morningHour).toBe(9);
    expect(updateRes.preferences?.reminderMinutesBefore).toBe(30);

    const [user] = await db
      .select({ preferences: users.preferences })
      .from(users)
      .where(eq(users.id, testUser.id));

    expect(user.preferences.notifications?.morningDaily).toBe(false);
    expect(user.preferences.notifications?.morningHour).toBe(9);
    expect(user.preferences.notifications?.reminderMinutesBefore).toBe(30);
  });

  it("should enforce idempotency and avoid duplicate notifications", async () => {
    // 1. Subscribe user
    const endpoint = `https://fcm.googleapis.com/fcm/send/idempotent-${Date.now()}`;
    await savePushSubscriptionAction({
      endpoint,
      keys: { p256dh: "k", auth: "a" },
    });

    // 2. Set user timezone and preferences to match test
    await db
      .update(users)
      .set({
        preferences: {
          ...testUser.preferences,
          timezone: "UTC",
          notifications: {
            enabled: true,
            morningDaily: true,
            morningHour: 8,
            taskReminders: true,
            reminderMinutesBefore: 15,
          },
        },
      })
      .where(eq(users.id, testUser.id));

    // 3. Create a task for today
    const [task] = await db
      .insert(tasks)
      .values({
        userId: testUser.id,
        workspaceId: testUser.preferences.activeWorkspaceId!,
        title: "Idempotency Test Task",
        date: "2026-10-02",
        time: "08:10",
        completed: false,
      })
      .returning();

    // 4. Test dry-run dispatch at 08:00 UTC
    const refDate = new Date("2026-10-02T08:00:00.000Z");
    const firstRun = await dispatchNotifications({
      refDate,
      dryRun: true,
    });

    expect(firstRun.morningSummariesSent).toBeGreaterThanOrEqual(1);

    // 5. Insert an idempotency log record for morning summary
    await db.insert(notificationLogs).values({
      userId: testUser.id,
      type: "morning_summary",
      date: "2026-10-02",
      status: "sent",
    });

    // 6. Running dispatch again should skip because of idempotency
    const secondRun = await dispatchNotifications({
      refDate,
      dryRun: true,
    });

    expect(secondRun.morningSummariesSkipped).toBeGreaterThanOrEqual(1);

    // 7. Insert an idempotency log record for task reminder
    await db.insert(notificationLogs).values({
      userId: testUser.id,
      type: "task_reminder",
      taskId: task.id,
      status: "sent",
    });

    // 8. Unique constraint violation test: attempting to insert same morning_summary or task_reminder must throw
    await expect(
      db.insert(notificationLogs).values({
        userId: testUser.id,
        type: "morning_summary",
        date: "2026-10-02",
        status: "sent",
      })
    ).rejects.toThrow();

    await expect(
      db.insert(notificationLogs).values({
        userId: testUser.id,
        type: "task_reminder",
        taskId: task.id,
        status: "sent",
      })
    ).rejects.toThrow();
  });
});
