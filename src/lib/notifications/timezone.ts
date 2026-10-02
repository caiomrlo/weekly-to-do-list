export interface UserLocalDateTime {
  dateStr: string; // 'YYYY-MM-DD'
  timeStr: string; // 'HH:mm'
  hour: number;    // 0 - 23
  minute: number;  // 0 - 59
}

export function isValidTimezone(timezone?: string | null): boolean {
  if (!timezone || typeof timezone !== "string") return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

export function getUserLocalDateTime(
  timezone?: string | null,
  refDate: Date = new Date()
): UserLocalDateTime {
  const safeTimezone = isValidTimezone(timezone) ? (timezone as string) : "UTC";

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: safeTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(refDate);
  const partMap: Record<string, string> = {};
  for (const part of parts) {
    partMap[part.type] = part.value;
  }

  const dateStr = `${partMap.year}-${partMap.month}-${partMap.day}`;
  const hour = parseInt(partMap.hour ?? "0", 10);
  const minute = parseInt(partMap.minute ?? "0", 10);
  const timeStr = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

  return {
    dateStr,
    timeStr,
    hour,
    minute,
  };
}
