export interface AvatarColorOption {
  key: string;
  label: string;
  bgClass: string;
  subtleClass: string;
  borderClass: string;
}

export const AVATAR_COLORS: Record<string, AvatarColorOption> = {
  amber: {
    key: "amber",
    label: "Amber",
    bgClass: "bg-amber-500 text-white",
    subtleClass: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    borderClass: "border-amber-400",
  },
  indigo: {
    key: "indigo",
    label: "Indigo",
    bgClass: "bg-indigo-500 text-white",
    subtleClass: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
    borderClass: "border-indigo-400",
  },
  teal: {
    key: "teal",
    label: "Teal",
    bgClass: "bg-teal-500 text-white",
    subtleClass: "bg-teal-500/15 text-teal-600 dark:text-teal-400",
    borderClass: "border-teal-400",
  },
  rose: {
    key: "rose",
    label: "Rose",
    bgClass: "bg-rose-500 text-white",
    subtleClass: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
    borderClass: "border-rose-400",
  },
  violet: {
    key: "violet",
    label: "Violet",
    bgClass: "bg-violet-500 text-white",
    subtleClass: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
    borderClass: "border-violet-400",
  },
  sky: {
    key: "sky",
    label: "Sky",
    bgClass: "bg-sky-500 text-white",
    subtleClass: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
    borderClass: "border-sky-400",
  },
  emerald: {
    key: "emerald",
    label: "Emerald",
    bgClass: "bg-emerald-500 text-white",
    subtleClass: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    borderClass: "border-emerald-400",
  },
  cyan: {
    key: "cyan",
    label: "Cyan",
    bgClass: "bg-cyan-500 text-white",
    subtleClass: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
    borderClass: "border-cyan-400",
  },
  orange: {
    key: "orange",
    label: "Orange",
    bgClass: "bg-orange-500 text-white",
    subtleClass: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
    borderClass: "border-orange-400",
  },
  fuchsia: {
    key: "fuchsia",
    label: "Fuchsia",
    bgClass: "bg-fuchsia-500 text-white",
    subtleClass: "bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400",
    borderClass: "border-fuchsia-400",
  },
  pink: {
    key: "pink",
    label: "Pink",
    bgClass: "bg-pink-500 text-white",
    subtleClass: "bg-pink-500/15 text-pink-600 dark:text-pink-400",
    borderClass: "border-pink-400",
  },
  blue: {
    key: "blue",
    label: "Blue",
    bgClass: "bg-blue-500 text-white",
    subtleClass: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
    borderClass: "border-blue-400",
  },
};

export const AVATAR_COLOR_KEYS = Object.keys(AVATAR_COLORS);
export const DEFAULT_AVATAR_COLOR_KEY = "amber";

/**
 * Returns a random avatar color key from the palette.
 */
export function getRandomAvatarColor(): string {
  const index = Math.floor(Math.random() * AVATAR_COLOR_KEYS.length);
  return AVATAR_COLOR_KEYS[index];
}

/**
 * Computes a deterministic color key based on a string seed (e.g. userId or email).
 */
export function getDeterministicAvatarColor(seed: string): string {
  if (!seed) return DEFAULT_AVATAR_COLOR_KEY;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % AVATAR_COLOR_KEYS.length;
  return AVATAR_COLOR_KEYS[index];
}

/**
 * Resolves a valid avatar color key.
 * If colorKey is valid, returns it.
 * If colorKey is missing or invalid, falls back to a deterministic color based on seed.
 */
export function resolveAvatarColor(
  colorKey?: string | null,
  seed?: string
): string {
  if (colorKey && AVATAR_COLORS[colorKey]) {
    return colorKey;
  }
  if (seed) {
    return getDeterministicAvatarColor(seed);
  }
  return DEFAULT_AVATAR_COLOR_KEY;
}

/**
 * Retrieves the style classes for a given color key (or resolves via seed fallback).
 */
export function getAvatarColorStyles(
  colorKey?: string | null,
  seed?: string
): AvatarColorOption {
  const resolvedKey = resolveAvatarColor(colorKey, seed);
  return AVATAR_COLORS[resolvedKey] || AVATAR_COLORS[DEFAULT_AVATAR_COLOR_KEY];
}
