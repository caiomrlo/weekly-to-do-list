import { describe, it, expect } from "vitest";
import {
  toDateString,
  parseDateString,
  getMondayOfWeek,
  getWeekDays,
  formatWeekRange,
  formatMonthYear,
  formatDuration,
  minutesToTimeString,
  timeStringToMinutes,
  parseNaturalDuration,
  formatDayShort,
} from "@/lib/date-utils";

describe("date-utils", () => {
  describe("toDateString and parseDateString", () => {
    it("should format Date objects to YYYY-MM-DD string", () => {
      const date = new Date(2026, 8, 12); // September 12, 2026
      expect(toDateString(date)).toBe("2026-09-12");
    });

    it("should correctly pad single-digit months and days with leading zeros", () => {
      const date = new Date(2026, 0, 5); // January 5, 2026
      expect(toDateString(date)).toBe("2026-01-05");
    });

    it("should parse YYYY-MM-DD strings back into Date objects matching local values", () => {
      const parsed = parseDateString("2026-09-12");
      expect(parsed.getFullYear()).toBe(2026);
      expect(parsed.getMonth()).toBe(8); // 0-indexed: 8 is September
      expect(parsed.getDate()).toBe(12);
    });
  });

  describe("getMondayOfWeek", () => {
    it("should return the same date if the reference date is already Monday", () => {
      const monday = new Date(2026, 8, 7); // Mon Sep 7, 2026
      const result = getMondayOfWeek(monday);
      expect(toDateString(result)).toBe("2026-09-07");
    });

    it("should calculate Monday for mid-week days (e.g. Wednesday, Friday)", () => {
      const wednesday = new Date(2026, 8, 9); // Wed Sep 9, 2026
      const friday = new Date(2026, 8, 11); // Fri Sep 11, 2026
      expect(toDateString(getMondayOfWeek(wednesday))).toBe("2026-09-07");
      expect(toDateString(getMondayOfWeek(friday))).toBe("2026-09-07");
    });

    it("should offset backwards to the Monday of the current week for Sunday (day 0)", () => {
      const sunday = new Date(2026, 8, 13); // Sun Sep 13, 2026
      expect(toDateString(getMondayOfWeek(sunday))).toBe("2026-09-07");
    });

    it("should handle month boundaries correctly", () => {
      const wednesday = new Date(2026, 9, 1); // Thu Oct 1, 2026
      const monday = getMondayOfWeek(wednesday);
      expect(toDateString(monday)).toBe("2026-09-28");
    });

    it("should handle year boundaries correctly (e.g. late Dec / early Jan)", () => {
      const janFirst = new Date(2026, 0, 1); // Thu Jan 1, 2026
      const monday = getMondayOfWeek(janFirst);
      expect(toDateString(monday)).toBe("2025-12-29");
    });
  });

  describe("getWeekDays", () => {
    it("should generate 7 consecutive days starting from Monday", () => {
      const monday = new Date(2026, 8, 7);
      const days = getWeekDays(monday, "2026-09-09");

      expect(days).toHaveLength(7);
      expect(days[0].dateStr).toBe("2026-09-07");
      expect(days[0].dayName).toBe("Monday");
      expect(days[0].dayOfWeek).toBe(1);
      expect(days[0].isToday).toBe(false);

      expect(days[2].dateStr).toBe("2026-09-09");
      expect(days[2].isToday).toBe(true);

      expect(days[6].dateStr).toBe("2026-09-13");
      expect(days[6].dayName).toBe("Sunday");
      expect(days[6].dayOfWeek).toBe(0);
    });
  });

  describe("formatWeekRange", () => {
    it("should format week range within the same month", () => {
      const monday = new Date(2026, 8, 7); // Sep 7 to Sep 13
      expect(formatWeekRange(monday)).toBe("September 07 – 13, 2026");
    });

    it("should format week range across months within the same year", () => {
      const monday = new Date(2026, 8, 28); // Sep 28 to Oct 4
      expect(formatWeekRange(monday)).toBe("September 28 – October 04, 2026");
    });

    it("should format week range across different years", () => {
      const monday = new Date(2026, 11, 28); // Dec 28, 2026 to Jan 3, 2027
      expect(formatWeekRange(monday)).toBe("December 28, 2026 – January 03, 2027");
    });
  });

  describe("formatMonthYear", () => {
    it("should format single month and year", () => {
      const monday = new Date(2026, 8, 7);
      expect(formatMonthYear(monday)).toBe("September, 2026");
    });

    it("should format split months in same year", () => {
      const monday = new Date(2026, 8, 28);
      expect(formatMonthYear(monday)).toBe("September / October, 2026");
    });

    it("should format split months and years across year boundary", () => {
      const monday = new Date(2026, 11, 28);
      expect(formatMonthYear(monday)).toBe("December 2026 / January 2027");
    });
  });

  describe("formatDuration", () => {
    it("should return empty string for null, undefined, or non-positive numbers", () => {
      expect(formatDuration(null)).toBe("");
      expect(formatDuration(undefined)).toBe("");
      expect(formatDuration(0)).toBe("");
      expect(formatDuration(-15)).toBe("");
    });

    it("should format hours-only durations", () => {
      expect(formatDuration(60)).toBe("1h");
      expect(formatDuration(120)).toBe("2h");
    });

    it("should format minutes-only durations", () => {
      expect(formatDuration(45)).toBe("45min");
      expect(formatDuration(15)).toBe("15min");
    });

    it("should format combined hours and minutes durations", () => {
      expect(formatDuration(90)).toBe("1h 30min");
      expect(formatDuration(135)).toBe("2h 15min");
    });
  });

  describe("minutesToTimeString and timeStringToMinutes", () => {
    it("should convert minutes to HH:mm string", () => {
      expect(minutesToTimeString(90)).toBe("01:30");
      expect(minutesToTimeString(570)).toBe("09:30");
      expect(minutesToTimeString(null)).toBe("");
      expect(minutesToTimeString(0)).toBe("");
    });

    it("should convert HH:mm string to minutes", () => {
      expect(timeStringToMinutes("01:30")).toBe(90);
      expect(timeStringToMinutes("9:30")).toBe(570);
      expect(timeStringToMinutes("00:45")).toBe(45);
    });

    it("should reject invalid time strings", () => {
      expect(timeStringToMinutes("")).toBeNull();
      expect(timeStringToMinutes(null)).toBeNull();
      expect(timeStringToMinutes("invalid")).toBeNull();
      expect(timeStringToMinutes("12:65")).toBeNull(); // minutes > 59
      expect(timeStringToMinutes("00:00")).toBeNull(); // zero minutes returns null
    });
  });

  describe("parseNaturalDuration", () => {
    it("should parse colon time formats", () => {
      expect(parseNaturalDuration("1:30")).toBe(90);
      expect(parseNaturalDuration("0:45")).toBe(45);
      expect(parseNaturalDuration("02:00")).toBe(120);
    });

    it("should parse decimal hour formats with dot or comma", () => {
      expect(parseNaturalDuration("1.5h")).toBe(90);
      expect(parseNaturalDuration("1,5h")).toBe(90);
      expect(parseNaturalDuration("2 hours")).toBe(120);
      expect(parseNaturalDuration("0.5 horas")).toBe(30);
    });

    it("should parse combined hour and minute expressions", () => {
      expect(parseNaturalDuration("1h30")).toBe(90);
      expect(parseNaturalDuration("1h 30m")).toBe(90);
      expect(parseNaturalDuration("2h 15min")).toBe(135);
      expect(parseNaturalDuration("1 hora 45 minutos")).toBe(105);
    });

    it("should parse minutes-only formats", () => {
      expect(parseNaturalDuration("30m")).toBe(30);
      expect(parseNaturalDuration("45min")).toBe(45);
      expect(parseNaturalDuration("15 minutes")).toBe(15);
    });

    it("should parse standalone numbers intelligently", () => {
      expect(parseNaturalDuration("2")).toBe(120); // <= 12 interpreted as hours
      expect(parseNaturalDuration("1.5")).toBe(90); // decimal interpreted as hours
      expect(parseNaturalDuration("45")).toBe(45); // > 12 interpreted as minutes
    });

    it("should return null for malformed or empty inputs", () => {
      expect(parseNaturalDuration("")).toBeNull();
      expect(parseNaturalDuration(null)).toBeNull();
      expect(parseNaturalDuration("abc")).toBeNull();
    });
  });

  describe("formatDayShort", () => {
    it("should format valid date strings into short display titles", () => {
      expect(formatDayShort("2026-09-07")).toBe("Mon, Sep 7");
      expect(formatDayShort("2026-09-12")).toBe("Sat, Sep 12");
    });

    it("should return empty string for falsy inputs", () => {
      expect(formatDayShort("")).toBe("");
      expect(formatDayShort(null)).toBe("");
    });

    it("should return original string when given unparseable formats", () => {
      expect(formatDayShort("not-a-date")).toBe("not-a-date");
    });
  });
});
