import { describe, it, expect } from "vitest";
import {
  STATUS_COLORS,
  STATUS_CATEGORY_LABELS,
  DEFAULT_STATUSES,
  getStatusStyles,
} from "@/lib/status-utils";

describe("status-utils", () => {
  describe("STATUS_COLORS", () => {
    it("should define standard color options with badge and dot classes", () => {
      const expectedKeys = [
        "slate",
        "amber",
        "emerald",
        "indigo",
        "violet",
        "rose",
        "sky",
        "orange",
      ];

      for (const key of expectedKeys) {
        expect(STATUS_COLORS[key]).toBeDefined();
        expect(STATUS_COLORS[key].key).toBe(key);
        expect(STATUS_COLORS[key].label).toBeTruthy();
        expect(STATUS_COLORS[key].badgeClass).toBeTruthy();
        expect(STATUS_COLORS[key].dotClass).toBeTruthy();
      }
    });
  });

  describe("STATUS_CATEGORY_LABELS", () => {
    it("should define human-readable labels for standard categories", () => {
      expect(STATUS_CATEGORY_LABELS.todo).toBe("To Do");
      expect(STATUS_CATEGORY_LABELS.doing).toBe("Doing");
      expect(STATUS_CATEGORY_LABELS.done).toBe("Done");
    });
  });

  describe("DEFAULT_STATUSES", () => {
    it("should contain 3 base statuses all marked isDefault: true", () => {
      expect(DEFAULT_STATUSES).toHaveLength(3);

      const [todo, doing, done] = DEFAULT_STATUSES;

      expect(todo).toEqual({
        name: "To Do",
        color: "slate",
        category: "todo",
        order: 0,
        isDefault: true,
      });

      expect(doing).toEqual({
        name: "Doing",
        color: "amber",
        category: "doing",
        order: 1,
        isDefault: true,
      });

      expect(done).toEqual({
        name: "Done",
        color: "emerald",
        category: "done",
        order: 2,
        isDefault: true,
      });
    });
  });

  describe("getStatusStyles", () => {
    it("should return the correct style object for a known color key", () => {
      const styles = getStatusStyles("emerald");
      expect(styles.key).toBe("emerald");
      expect(styles.label).toBe("Emerald");
      expect(styles.dotClass).toBe("bg-emerald-500");
    });

    it("should fall back to slate if colorKey is null, undefined, or empty", () => {
      expect(getStatusStyles(null).key).toBe("slate");
      expect(getStatusStyles(undefined).key).toBe("slate");
      expect(getStatusStyles("").key).toBe("slate");
    });

    it("should fall back to slate if colorKey is unknown", () => {
      expect(getStatusStyles("non-existent-color").key).toBe("slate");
    });
  });
});
