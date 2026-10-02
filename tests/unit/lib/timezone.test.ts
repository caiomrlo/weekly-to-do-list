import { describe, it, expect } from "vitest";
import { getUserLocalDateTime, isValidTimezone } from "@/lib/notifications/timezone";

describe("Unit: Timezone Utilities", () => {
  it("should validate valid and invalid IANA timezone identifiers", () => {
    expect(isValidTimezone("America/Sao_Paulo")).toBe(true);
    expect(isValidTimezone("UTC")).toBe(true);
    expect(isValidTimezone("Europe/London")).toBe(true);
    expect(isValidTimezone("Asia/Tokyo")).toBe(true);
    expect(isValidTimezone("Invalid/Timezone")).toBe(false);
    expect(isValidTimezone("")).toBe(false);
    expect(isValidTimezone(null)).toBe(false);
    expect(isValidTimezone(undefined)).toBe(false);
  });

  it("should calculate correct local date and time for a fixed UTC instant across different timezones", () => {
    // 2026-10-02 14:30:00 UTC
    const refDate = new Date("2026-10-02T14:30:00.000Z");

    // UTC
    const utcTime = getUserLocalDateTime("UTC", refDate);
    expect(utcTime.dateStr).toBe("2026-10-02");
    expect(utcTime.hour).toBe(14);
    expect(utcTime.minute).toBe(30);
    expect(utcTime.timeStr).toBe("14:30");

    // America/Sao_Paulo is UTC-3 -> 11:30
    const spTime = getUserLocalDateTime("America/Sao_Paulo", refDate);
    expect(spTime.dateStr).toBe("2026-10-02");
    expect(spTime.hour).toBe(11);
    expect(spTime.minute).toBe(30);
    expect(spTime.timeStr).toBe("11:30");

    // Asia/Tokyo is UTC+9 -> 23:30
    const tokyoTime = getUserLocalDateTime("Asia/Tokyo", refDate);
    expect(tokyoTime.dateStr).toBe("2026-10-02");
    expect(tokyoTime.hour).toBe(23);
    expect(tokyoTime.minute).toBe(30);

    // Pacific/Auckland is UTC+13 (DST in October) -> next day 2026-10-03 03:30
    const aucklandTime = getUserLocalDateTime("Pacific/Auckland", refDate);
    expect(aucklandTime.dateStr).toBe("2026-10-03");
    expect(aucklandTime.hour).toBe(3);
    expect(aucklandTime.minute).toBe(30);
  });

  it("should fallback safely to UTC when invalid timezone is passed", () => {
    const refDate = new Date("2026-10-02T12:00:00.000Z");
    const result = getUserLocalDateTime("Invalid/Timezone", refDate);
    expect(result.dateStr).toBe("2026-10-02");
    expect(result.hour).toBe(12);
  });
});
