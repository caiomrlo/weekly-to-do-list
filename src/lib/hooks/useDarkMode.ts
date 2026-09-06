"use client";

import { useSyncExternalStore } from "react";

function getClientDarkMode(): boolean {
  return typeof document !== "undefined"
    ? document.documentElement.classList.contains("dark")
    : false;
}

function getServerDarkMode(): boolean {
  return false;
}

function subscribeDarkMode(callback: () => void) {
  if (typeof MutationObserver === "undefined") return () => {};
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

export function useDarkMode(): boolean {
  return useSyncExternalStore(
    subscribeDarkMode,
    getClientDarkMode,
    getServerDarkMode
  );
}
