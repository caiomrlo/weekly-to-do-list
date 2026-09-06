"use client";

import { useSyncExternalStore } from "react";
import { toDateString } from "@/lib/date-utils";

let cachedToday = "";

function getClientToday(): string {
  const current = toDateString(new Date());
  if (current !== cachedToday) {
    cachedToday = current;
  }
  return cachedToday;
}

function getServerToday(): string {
  return "";
}

function subscribeToday(callback: () => void) {
  window.addEventListener("focus", callback);
  const timer = setInterval(callback, 60000);
  return () => {
    window.removeEventListener("focus", callback);
    clearInterval(timer);
  };
}

export function useTodayDateStr(): string {
  return useSyncExternalStore(subscribeToday, getClientToday, getServerToday);
}
