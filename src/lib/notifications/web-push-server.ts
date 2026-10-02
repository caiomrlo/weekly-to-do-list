import webpush from "web-push";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { eq } from "drizzle-orm";

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

let vapidConfigured = false;

export function ensureVapidConfigured(): boolean {
  if (vapidConfigured) return true;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:notifications@weeklytodo.com";

  if (!publicKey || !privateKey) {
    console.warn("[WebPush] VAPID keys are not configured. Push notifications will be skipped.");
    return false;
  }

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    vapidConfigured = true;
    return true;
  } catch (err) {
    console.error("[WebPush] Failed to configure VAPID details:", err);
    return false;
  }
}

export async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: PushNotificationPayload
): Promise<{ success: boolean; expired?: boolean; error?: string }> {
  if (!ensureVapidConfigured()) {
    return { success: false, error: "VAPID not configured" };
  }

  const pushSubscription: webpush.PushSubscription = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
  };

  try {
    await webpush.sendNotification(
      pushSubscription,
      JSON.stringify({
        title: payload.title,
        body: payload.body,
        icon: payload.icon || "/icons/icon-192.png",
        badge: payload.badge || "/icons/icon-192.png",
        url: payload.url || "/",
        tag: payload.tag || "weekly-task-notification",
        data: {
          url: payload.url || "/",
          ...payload.data,
        },
      })
    );
    return { success: true };
  } catch (err: unknown) {
    const webPushErr = err as { statusCode?: number; message?: string };
    if (webPushErr.statusCode === 404 || webPushErr.statusCode === 410) {
      console.info(`[WebPush] Subscription expired (${webPushErr.statusCode}). Removing endpoint: ${subscription.endpoint}`);
      try {
        await db
          .delete(pushSubscriptions)
          .where(eq(pushSubscriptions.endpoint, subscription.endpoint));
      } catch (cleanupErr) {
        console.error("[WebPush] Error cleaning up expired subscription:", cleanupErr);
      }
      return { success: false, expired: true, error: "Subscription expired or unsubscribed" };
    }

    console.error("[WebPush] Push notification send error:", err);
    return {
      success: false,
      error: webPushErr.message || "Failed to send notification",
    };
  }
}

export async function sendPushToUser(
  userId: string,
  payload: PushNotificationPayload
): Promise<{ successCount: number; failureCount: number; expiredCount: number }> {
  const subscriptions = await db
    .select({
      id: pushSubscriptions.id,
      endpoint: pushSubscriptions.endpoint,
      p256dh: pushSubscriptions.p256dh,
      auth: pushSubscriptions.auth,
    })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));

  if (subscriptions.length === 0) {
    return { successCount: 0, failureCount: 0, expiredCount: 0 };
  }

  let successCount = 0;
  let failureCount = 0;
  let expiredCount = 0;

  for (const sub of subscriptions) {
    const result = await sendWebPush(sub, payload);
    if (result.success) {
      successCount++;
    } else if (result.expired) {
      expiredCount++;
    } else {
      failureCount++;
    }
  }

  return { successCount, failureCount, expiredCount };
}
