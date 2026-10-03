"use server";

import { db } from "@/db";
import {
  users,
  pushSubscriptions,
  NotificationPreferences,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export interface PushSubscriptionInput {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string;
}

export async function getVapidPublicKeyAction(): Promise<{
  publicKey?: string;
  error?: string;
}> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  const publicKey =
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;

  if (!publicKey) {
    console.error("[NotificationsAction] VAPID public key is not set in environment.");
    return { error: "VAPID public key is not configured on the server." };
  }

  return { publicKey };
}

export async function savePushSubscriptionAction(
  input: PushSubscriptionInput
): Promise<{ success?: boolean; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  if (!input.endpoint || !input.keys?.p256dh || !input.keys?.auth) {
    return { error: "Invalid subscription payload." };
  }

  try {
    // Check if subscription already exists for this endpoint
    const [existing] = await db
      .select({ id: pushSubscriptions.id })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, input.endpoint))
      .limit(1);

    if (existing) {
      await db
        .update(pushSubscriptions)
        .set({
          userId: session.userId,
          p256dh: input.keys.p256dh,
          auth: input.keys.auth,
          userAgent: input.userAgent || null,
          updatedAt: new Date(),
        })
        .where(eq(pushSubscriptions.id, existing.id));
    } else {
      await db.insert(pushSubscriptions).values({
        userId: session.userId,
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent: input.userAgent || null,
      });
    }

    // Also ensure notification preferences master toggle is enabled
    const [user] = await db
      .select({ preferences: users.preferences })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);

    const currentPrefs = user?.preferences || {};
    const currentNotif = currentPrefs.notifications || DEFAULT_NOTIFICATION_PREFERENCES;

    if (!currentNotif.enabled) {
      await db
        .update(users)
        .set({
          preferences: {
            ...currentPrefs,
            notifications: {
              ...currentNotif,
              enabled: true,
            },
          },
        })
        .where(eq(users.id, session.userId));
    }

    revalidatePath("/");
    return { success: true };
  } catch (err) {
    console.error("[NotificationsAction] Failed to save subscription:", err);
    return { error: "Failed to save push subscription." };
  }
}

export async function deletePushSubscriptionAction(
  endpoint: string
): Promise<{ success?: boolean; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  try {
    await db
      .delete(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.userId, session.userId),
          eq(pushSubscriptions.endpoint, endpoint)
        )
      );

    revalidatePath("/");
    return { success: true };
  } catch (err) {
    console.error("[NotificationsAction] Failed to delete subscription:", err);
    return { error: "Failed to delete push subscription." };
  }
}

export async function updateNotificationPreferencesAction(
  newPreferences: Partial<NotificationPreferences>
): Promise<{
  success?: boolean;
  preferences?: NotificationPreferences;
  error?: string;
}> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  try {
    const [user] = await db
      .select({ preferences: users.preferences })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);

    const currentPrefs = user?.preferences || {};
    const currentNotif = currentPrefs.notifications || DEFAULT_NOTIFICATION_PREFERENCES;

    const mergedNotif: NotificationPreferences = {
      ...currentNotif,
      ...newPreferences,
    };

    await db
      .update(users)
      .set({
        preferences: {
          ...currentPrefs,
          notifications: mergedNotif,
        },
      })
      .where(eq(users.id, session.userId));

    revalidatePath("/");
    return { success: true, preferences: mergedNotif };
  } catch (err) {
    console.error("[NotificationsAction] Failed to update preferences:", err);
    return { error: "Failed to update notification preferences." };
  }
}
