"use client";

import { useState, useEffect, useCallback } from "react";
import {
  UserPreferences,
  NotificationPreferences,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from "@/db/schema";
import {
  savePushSubscriptionAction,
  deletePushSubscriptionAction,
  updateNotificationPreferencesAction,
  getVapidPublicKeyAction,
} from "@/app/actions/notifications";
import { updateUserPreferencesAction } from "@/app/actions/user";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications(preferences: UserPreferences) {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [prevNotifProp, setPrevNotifProp] = useState(preferences.notifications);
  const [overrideNotifPrefs, setOverrideNotifPrefs] = useState<Partial<NotificationPreferences> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (preferences.notifications !== prevNotifProp) {
    setPrevNotifProp(preferences.notifications);
    setOverrideNotifPrefs(null);
  }

  const notificationPreferences: NotificationPreferences = {
    ...(preferences.notifications || DEFAULT_NOTIFICATION_PREFERENCES),
    ...overrideNotifPrefs,
  };

  // Auto-detect and sync timezone
  useEffect(() => {
    try {
      const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (browserTz && preferences.timezone !== browserTz) {
        updateUserPreferencesAction({ timezone: browserTz }).catch((err) => {
          console.error("Failed to auto-sync timezone:", err);
        });
      }
    } catch {
      // Ignore timezone detection errors
    }
  }, [preferences.timezone]);

  // Check initial browser capability and active subscription status
  useEffect(() => {
    if (typeof window === "undefined") return;

    const supported =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;

    if (!supported) return;

    navigator.serviceWorker.getRegistration("/sw.js").then((reg) => {
      setIsSupported(true);
      setPermission(Notification.permission);
      if (!reg) {
        setIsSubscribed(false);
        return;
      }
      reg.pushManager.getSubscription().then((sub) => {
        setIsSubscribed(Boolean(sub));
      });
    });
  }, []);

  const subscribe = useCallback(async () => {
    setError(null);
    setIsLoading(true);

    try {
      if (!isSupported) {
        throw new Error("Push notifications are not supported in this browser.");
      }

      let vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        const keyRes = await getVapidPublicKeyAction();
        if (keyRes.publicKey) {
          vapidPublicKey = keyRes.publicKey;
        } else if (keyRes.error) {
          throw new Error(keyRes.error);
        }
      }

      if (!vapidPublicKey) {
        throw new Error("Web Push is not configured on the server.");
      }

      // Request browser permission
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== "granted") {
        throw new Error("Notification permission was denied.");
      }

      // Register or get service worker
      let registration = await navigator.serviceWorker.getRegistration("/sw.js");
      if (!registration) {
        registration = await navigator.serviceWorker.register("/sw.js");
      }

      // Wait until service worker is active
      await navigator.serviceWorker.ready;

      // Get or create push subscription
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        const convertedKey = urlBase64ToUint8Array(vapidPublicKey);
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedKey as unknown as BufferSource,
        });
      }

      const subJson = subscription.toJSON();
      if (!subJson.endpoint || !subJson.keys?.p256dh || !subJson.keys?.auth) {
        throw new Error("Failed to retrieve push subscription credentials.");
      }

      // Save subscription in database
      const saveRes = await savePushSubscriptionAction({
        endpoint: subJson.endpoint,
        keys: {
          p256dh: subJson.keys.p256dh,
          auth: subJson.keys.auth,
        },
        userAgent: navigator.userAgent,
      });

      if (saveRes.error) {
        throw new Error(saveRes.error);
      }

      setIsSubscribed(true);
      setOverrideNotifPrefs((prev) => ({ ...prev, enabled: true }));
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to enable notifications.";
      setError(msg);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported]);

  const unsubscribe = useCallback(async () => {
    setError(null);
    setIsLoading(true);

    try {
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.getRegistration("/sw.js");
        if (registration) {
          const subscription = await registration.pushManager.getSubscription();
          if (subscription) {
            const endpoint = subscription.endpoint;
            await subscription.unsubscribe();
            await deletePushSubscriptionAction(endpoint);
          }
        }
      }

      await updateNotificationPreferencesAction({ enabled: false });
      setIsSubscribed(false);
      setOverrideNotifPrefs((prev) => ({ ...prev, enabled: false }));
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to disable notifications.";
      setError(msg);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updatePreferences = useCallback(
    async (partial: Partial<NotificationPreferences>) => {
      setError(null);
      setOverrideNotifPrefs((prev) => ({ ...prev, ...partial }));
      try {
        const res = await updateNotificationPreferencesAction(partial);
        if (res.error) {
          setError(res.error);
          setOverrideNotifPrefs(null);
          return false;
        }
        return true;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to update preferences.";
        setError(msg);
        setOverrideNotifPrefs(null);
        return false;
      }
    },
    []
  );

  return {
    isSupported,
    permission,
    isSubscribed: isSubscribed && notificationPreferences.enabled,
    notificationPreferences,
    isLoading,
    error,
    subscribe,
    unsubscribe,
    updatePreferences,
  };
}
