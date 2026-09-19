"use client";

import { useSyncExternalStore, useCallback } from "react";

function subscribeStorage(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  window.addEventListener("local-storage-sync", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("local-storage-sync", callback);
  };
}

export function useLocalStorage<T extends string>(
  key: string,
  defaultValue: T,
  validator?: (val: string) => boolean
): [T, (nextVal: T) => void] {
  const getSnapshot = useCallback((): T => {
    try {
      if (typeof window !== "undefined") {
        const item = localStorage.getItem(key);
        if (item !== null && (!validator || validator(item))) {
          return item as T;
        }
      }
    } catch {}
    return defaultValue;
  }, [key, defaultValue, validator]);

  const getServerSnapshot = useCallback((): T => {
    return defaultValue;
  }, [defaultValue]);

  const value = useSyncExternalStore(
    subscribeStorage,
    getSnapshot,
    getServerSnapshot
  );

  const setValue = useCallback(
    (nextVal: T) => {
      try {
        if (typeof window !== "undefined") {
          localStorage.setItem(key, nextVal);
          window.dispatchEvent(new Event("local-storage-sync"));
        }
      } catch {}
    },
    [key]
  );

  return [value, setValue];
}
