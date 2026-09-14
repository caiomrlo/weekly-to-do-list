import { describe, it, expect } from "vitest";
import {
  calculateProjectedDates,
  formatRecurrenceLabel,
  diffDaysBetweenStr,
  getMondayOfDateStr,
  getDayOfWeekFromStr,
  getDaysInMonth,
  isLeapYear,
} from "@/lib/recurrence-utils";

describe("recurrence-utils", () => {
  describe("date helper math", () => {
    it("should calculate difference in days correctly across months and years", () => {
      expect(diffDaysBetweenStr("2026-09-14", "2026-09-14")).toBe(0);
      expect(diffDaysBetweenStr("2026-09-14", "2026-09-20")).toBe(6);
      expect(diffDaysBetweenStr("2026-09-28", "2026-10-02")).toBe(4);
      expect(diffDaysBetweenStr("2025-12-31", "2026-01-01")).toBe(1);
    });

    it("should get day of week correctly (0=Sun, 1=Mon, ..., 6=Sat)", () => {
      expect(getDayOfWeekFromStr("2026-09-14")).toBe(1); // Monday
      expect(getDayOfWeekFromStr("2026-09-20")).toBe(0); // Sunday
      expect(getDayOfWeekFromStr("2026-09-16")).toBe(3); // Wednesday
    });

    it("should identify Monday of any date string", () => {
      expect(getMondayOfDateStr("2026-09-14")).toBe("2026-09-14"); // Mon -> Mon
      expect(getMondayOfDateStr("2026-09-16")).toBe("2026-09-14"); // Wed -> Mon
      expect(getMondayOfDateStr("2026-09-20")).toBe("2026-09-14"); // Sun -> Mon
    });

    it("should identify leap years and month lengths", () => {
      expect(isLeapYear(2024)).toBe(true);
      expect(isLeapYear(2026)).toBe(false);
      expect(isLeapYear(2000)).toBe(true);
      expect(isLeapYear(1900)).toBe(false);
      expect(getDaysInMonth(2024, 2)).toBe(29);
      expect(getDaysInMonth(2026, 2)).toBe(28);
      expect(getDaysInMonth(2026, 9)).toBe(30);
      expect(getDaysInMonth(2026, 10)).toBe(31);
    });
  });

  describe("Daily Recurrence Projection", () => {
    it("projects every day (interval = 1)", () => {
      const dates = calculateProjectedDates(
        {
          frequency: "daily",
          interval: 1,
          startDate: "2026-09-14",
          endDate: null,
          daysOfWeek: null,
          dayOfMonth: null,
          monthOfYear: null,
          exceptions: [],
        },
        "2026-09-14",
        "2026-09-20"
      );

      expect(dates).toEqual([
        "2026-09-14",
        "2026-09-15",
        "2026-09-16",
        "2026-09-17",
        "2026-09-18",
        "2026-09-19",
        "2026-09-20",
      ]);
    });

    it("projects every 2 days (interval = 2)", () => {
      const dates = calculateProjectedDates(
        {
          frequency: "daily",
          interval: 2,
          startDate: "2026-09-14",
          endDate: null,
          daysOfWeek: null,
          dayOfMonth: null,
          monthOfYear: null,
          exceptions: [],
        },
        "2026-09-14",
        "2026-09-20"
      );

      expect(dates).toEqual(["2026-09-14", "2026-09-16", "2026-09-18", "2026-09-20"]);
    });

    it("respects startDate if window begins before startDate", () => {
      const dates = calculateProjectedDates(
        {
          frequency: "daily",
          interval: 1,
          startDate: "2026-09-16",
          endDate: null,
          daysOfWeek: null,
          dayOfMonth: null,
          monthOfYear: null,
          exceptions: [],
        },
        "2026-09-14",
        "2026-09-20"
      );

      expect(dates).toEqual([
        "2026-09-16",
        "2026-09-17",
        "2026-09-18",
        "2026-09-19",
        "2026-09-20",
      ]);
    });

    it("respects endDate and exceptions", () => {
      const dates = calculateProjectedDates(
        {
          frequency: "daily",
          interval: 1,
          startDate: "2026-09-14",
          endDate: "2026-09-18",
          daysOfWeek: null,
          dayOfMonth: null,
          monthOfYear: null,
          exceptions: ["2026-09-16"],
        },
        "2026-09-14",
        "2026-09-20"
      );

      expect(dates).toEqual(["2026-09-14", "2026-09-15", "2026-09-17", "2026-09-18"]);
    });
  });

  describe("Weekly Recurrence Projection", () => {
    it("projects every week on Monday", () => {
      const dates = calculateProjectedDates(
        {
          frequency: "weekly",
          interval: 1,
          startDate: "2026-09-14",
          endDate: null,
          daysOfWeek: [1], // Monday
          dayOfMonth: null,
          monthOfYear: null,
          exceptions: [],
        },
        "2026-09-14",
        "2026-09-27"
      );

      expect(dates).toEqual(["2026-09-14", "2026-09-21"]);
    });

    it("projects multiple weekdays (e.g. Mon and Wed)", () => {
      const dates = calculateProjectedDates(
        {
          frequency: "weekly",
          interval: 1,
          startDate: "2026-09-14",
          endDate: null,
          daysOfWeek: [1, 3], // Mon, Wed
          dayOfMonth: null,
          monthOfYear: null,
          exceptions: [],
        },
        "2026-09-14",
        "2026-09-20"
      );

      expect(dates).toEqual(["2026-09-14", "2026-09-16"]);
    });

    it("projects every 2 weeks (interval = 2)", () => {
      const dates = calculateProjectedDates(
        {
          frequency: "weekly",
          interval: 2,
          startDate: "2026-09-14",
          endDate: null,
          daysOfWeek: [1],
          dayOfMonth: null,
          monthOfYear: null,
          exceptions: [],
        },
        "2026-09-14",
        "2026-10-04"
      );

      // Week 1 (Sep 14) matches, Week 2 (Sep 21) skipped, Week 3 (Sep 28) matches
      expect(dates).toEqual(["2026-09-14", "2026-09-28"]);
    });
  });

  describe("Monthly Recurrence Projection", () => {
    it("projects on the 15th of every month", () => {
      const dates = calculateProjectedDates(
        {
          frequency: "monthly",
          interval: 1,
          startDate: "2026-09-15",
          endDate: null,
          daysOfWeek: null,
          dayOfMonth: 15,
          monthOfYear: null,
          exceptions: [],
        },
        "2026-09-01",
        "2026-11-30"
      );

      expect(dates).toEqual(["2026-09-15", "2026-10-15", "2026-11-15"]);
    });

    it("handles month-end day clamping for months with fewer days (e.g. 31st in Feb/Apr)", () => {
      const dates = calculateProjectedDates(
        {
          frequency: "monthly",
          interval: 1,
          startDate: "2026-01-31",
          endDate: null,
          daysOfWeek: null,
          dayOfMonth: 31,
          monthOfYear: null,
          exceptions: [],
        },
        "2026-01-01",
        "2026-04-30"
      );

      // Jan 31, Feb 28 (non-leap year), Mar 31, Apr 30
      expect(dates).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
    });
  });

  describe("Yearly Recurrence Projection", () => {
    it("projects on specific date every year", () => {
      const dates = calculateProjectedDates(
        {
          frequency: "yearly",
          interval: 1,
          startDate: "2026-10-15",
          endDate: null,
          daysOfWeek: null,
          dayOfMonth: 15,
          monthOfYear: 10,
          exceptions: [],
        },
        "2026-10-01",
        "2028-10-31"
      );

      expect(dates).toEqual(["2026-10-15", "2027-10-15", "2028-10-15"]);
    });
  });

  describe("formatRecurrenceLabel", () => {
    it("formats daily patterns", () => {
      expect(formatRecurrenceLabel({ frequency: "daily", interval: 1 })).toBe("Daily");
      expect(formatRecurrenceLabel({ frequency: "daily", interval: 2 })).toBe("Every 2 days");
    });

    it("formats weekly patterns", () => {
      expect(
        formatRecurrenceLabel({ frequency: "weekly", interval: 1, daysOfWeek: [1] })
      ).toBe("Weekly on Mon");
      expect(
        formatRecurrenceLabel({ frequency: "weekly", interval: 2, daysOfWeek: [1, 3] })
      ).toBe("Every 2 weeks on Mon, Wed");
    });

    it("formats monthly patterns", () => {
      expect(
        formatRecurrenceLabel({ frequency: "monthly", interval: 1, dayOfMonth: 15 })
      ).toBe("Monthly on the 15th");
      expect(
        formatRecurrenceLabel({ frequency: "monthly", interval: 2, dayOfMonth: 1 })
      ).toBe("Every 2 months on the 1st");
    });

    it("formats yearly patterns", () => {
      expect(
        formatRecurrenceLabel({
          frequency: "yearly",
          interval: 1,
          monthOfYear: 10,
          dayOfMonth: 15,
        })
      ).toBe("Yearly on Oct 15th");
    });
  });
});
