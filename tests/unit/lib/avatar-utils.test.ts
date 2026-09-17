import { describe, it, expect } from "vitest";
import {
  AVATAR_COLORS,
  AVATAR_COLOR_KEYS,
  DEFAULT_AVATAR_COLOR_KEY,
  getRandomAvatarColor,
  getDeterministicAvatarColor,
  resolveAvatarColor,
  getAvatarColorStyles,
} from "@/lib/avatar-utils";

describe("Avatar Utilities", () => {
  it("should contain a predefined palette with consistent structure", () => {
    expect(AVATAR_COLOR_KEYS.length).toBeGreaterThanOrEqual(6);
    for (const key of AVATAR_COLOR_KEYS) {
      const option = AVATAR_COLORS[key];
      expect(option.key).toBe(key);
      expect(option.label).toBeTruthy();
      expect(option.bgClass).toContain("text-white");
      expect(option.subtleClass).toBeTruthy();
      expect(option.borderClass).toBeTruthy();
    }
  });

  it("should return a random color from the palette", () => {
    const randomColor = getRandomAvatarColor();
    expect(AVATAR_COLOR_KEYS).toContain(randomColor);
  });

  it("should deterministically hash seeds into the same color", () => {
    const seedA = "user-uuid-12345";
    const seedB = "user-uuid-67890";

    const colorA1 = getDeterministicAvatarColor(seedA);
    const colorA2 = getDeterministicAvatarColor(seedA);
    expect(colorA1).toBe(colorA2);
    expect(AVATAR_COLOR_KEYS).toContain(colorA1);

    const colorB = getDeterministicAvatarColor(seedB);
    expect(AVATAR_COLOR_KEYS).toContain(colorB);
  });

  it("should resolve provided valid colors or fallback to seed/default", () => {
    expect(resolveAvatarColor("indigo", "user-uuid-12345")).toBe("indigo");
    expect(resolveAvatarColor("rose")).toBe("rose");

    // Invalid or null color with seed -> deterministic
    const fromSeed = resolveAvatarColor(null, "user-uuid-12345");
    expect(fromSeed).toBe(getDeterministicAvatarColor("user-uuid-12345"));

    // Invalid or null color without seed -> default
    expect(resolveAvatarColor(null, "")).toBe(DEFAULT_AVATAR_COLOR_KEY);
    expect(resolveAvatarColor("non-existent-color")).toBe(DEFAULT_AVATAR_COLOR_KEY);
  });

  it("should retrieve valid style objects", () => {
    const styles = getAvatarColorStyles("teal");
    expect(styles.key).toBe("teal");
    expect(styles.bgClass).toContain("bg-teal-500");

    const fallbackStyles = getAvatarColorStyles(null, "some-seed");
    expect(fallbackStyles).toBeDefined();
    expect(fallbackStyles.bgClass).toBeTruthy();
  });
});
