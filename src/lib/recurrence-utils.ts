import { RecurringRule, RecurrenceFrequency } from "@/db/schema";

export interface ParsedDate {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
}

export function parseDateParts(dateStr: string): ParsedDate {
  const [year, month, day] = dateStr.split("-").map(Number);
  return { year, month, day };
}

export function formatDateParts(year: number, month: number, day: number): string {
  const y = String(year).padStart(4, "0");
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function getDaysInMonth(year: number, month: number): number {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }
  if ([4, 6, 9, 11].includes(month)) {
    return 30;
  }
  return 31;
}

export function getDayOfWeekFromStr(dateStr: string): number {
  const { year, month, day } = parseDateParts(dateStr);
  const d = new Date(year, month - 1, day);
  return d.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
}

export function addDaysToStr(dateStr: string, daysToAdd: number): string {
  const { year, month, day } = parseDateParts(dateStr);
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() + daysToAdd);
  return formatDateParts(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

export function diffDaysBetweenStr(startStr: string, endStr: string): number {
  const { year: y1, month: m1, day: d1 } = parseDateParts(startStr);
  const { year: y2, month: m2, day: d2 } = parseDateParts(endStr);
  const date1 = Date.UTC(y1, m1 - 1, d1);
  const date2 = Date.UTC(y2, m2 - 1, d2);
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((date2 - date1) / msPerDay);
}

export function getMondayOfDateStr(dateStr: string): string {
  const dayOfWeek = getDayOfWeekFromStr(dateStr);
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  return addDaysToStr(dateStr, diff);
}

export function getDatesInRange(startStr: string, endStr: string): string[] {
  const dates: string[] = [];
  let curr = startStr;
  while (curr <= endStr) {
    dates.push(curr);
    curr = addDaysToStr(curr, 1);
  }
  return dates;
}

const WEEKDAY_SHORT_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_SHORT_NAMES = [
  "",
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function getOrdinalSuffix(n: number): string {
  const j = n % 10;
  const k = n % 100;
  if (j === 1 && k !== 11) return `${n}st`;
  if (j === 2 && k !== 12) return `${n}nd`;
  if (j === 3 && k !== 13) return `${n}rd`;
  return `${n}th`;
}

/**
 * Calculates projected dates within [windowStartStr, windowEndStr] for a recurring rule.
 */
export function calculateProjectedDates(
  rule: Pick<
    RecurringRule,
    | "frequency"
    | "interval"
    | "startDate"
    | "endDate"
    | "daysOfWeek"
    | "dayOfMonth"
    | "monthOfYear"
    | "exceptions"
  >,
  windowStartStr: string,
  windowEndStr: string
): string[] {
  const interval = Math.max(1, rule.interval || 1);
  const exceptionsSet = new Set(rule.exceptions || []);

  const effectiveStart = windowStartStr > rule.startDate ? windowStartStr : rule.startDate;
  const effectiveEnd = rule.endDate && rule.endDate < windowEndStr ? rule.endDate : windowEndStr;

  if (effectiveStart > effectiveEnd) {
    return [];
  }

  const windowDates = getDatesInRange(effectiveStart, effectiveEnd);
  const projected: string[] = [];

  switch (rule.frequency) {
    case "daily": {
      for (const dStr of windowDates) {
        if (exceptionsSet.has(dStr)) continue;
        const daysDiff = diffDaysBetweenStr(rule.startDate, dStr);
        if (daysDiff >= 0 && daysDiff % interval === 0) {
          projected.push(dStr);
        }
      }
      break;
    }

    case "weekly": {
      const defaultDay = getDayOfWeekFromStr(rule.startDate);
      const daysOfWeek =
        rule.daysOfWeek && rule.daysOfWeek.length > 0 ? rule.daysOfWeek : [defaultDay];
      const startMonday = getMondayOfDateStr(rule.startDate);

      for (const dStr of windowDates) {
        if (exceptionsSet.has(dStr)) continue;
        const dDay = getDayOfWeekFromStr(dStr);
        if (!daysOfWeek.includes(dDay)) continue;

        const dMonday = getMondayOfDateStr(dStr);
        const daysFromStartMonday = diffDaysBetweenStr(startMonday, dMonday);
        const weeksDiff = Math.floor(daysFromStartMonday / 7);

        if (weeksDiff >= 0 && weeksDiff % interval === 0) {
          projected.push(dStr);
        }
      }
      break;
    }

    case "monthly": {
      const sParts = parseDateParts(rule.startDate);
      const targetDay = rule.dayOfMonth || sParts.day;

      for (const dStr of windowDates) {
        if (exceptionsSet.has(dStr)) continue;
        const dParts = parseDateParts(dStr);
        const monthDiff = (dParts.year - sParts.year) * 12 + (dParts.month - sParts.month);

        if (monthDiff >= 0 && monthDiff % interval === 0) {
          const maxDayInMonth = getDaysInMonth(dParts.year, dParts.month);
          const effectiveTargetDay = Math.min(targetDay, maxDayInMonth);
          if (dParts.day === effectiveTargetDay) {
            projected.push(dStr);
          }
        }
      }
      break;
    }

    case "yearly": {
      const sParts = parseDateParts(rule.startDate);
      const targetMonth = rule.monthOfYear || sParts.month;
      const targetDay = rule.dayOfMonth || sParts.day;

      for (const dStr of windowDates) {
        if (exceptionsSet.has(dStr)) continue;
        const dParts = parseDateParts(dStr);
        const yearDiff = dParts.year - sParts.year;

        if (yearDiff >= 0 && yearDiff % interval === 0 && dParts.month === targetMonth) {
          const maxDayInMonth = getDaysInMonth(dParts.year, dParts.month);
          const effectiveTargetDay = Math.min(targetDay, maxDayInMonth);
          if (dParts.day === effectiveTargetDay) {
            projected.push(dStr);
          }
        }
      }
      break;
    }
  }

  return projected;
}

/**
 * Returns a concise, user-facing summary string for a recurrence rule.
 */
export function formatRecurrenceLabel(rule: {
  frequency: RecurrenceFrequency;
  interval?: number | null;
  daysOfWeek?: number[] | null;
  dayOfMonth?: number | null;
  monthOfYear?: number | null;
  endDate?: string | null;
}): string {
  const interval = Math.max(1, rule.interval || 1);

  let base = "";
  switch (rule.frequency) {
    case "daily":
      base = interval === 1 ? "Daily" : `Every ${interval} days`;
      break;

    case "weekly": {
      const days = rule.daysOfWeek && rule.daysOfWeek.length > 0
        ? rule.daysOfWeek.map((d) => WEEKDAY_SHORT_NAMES[d]).join(", ")
        : "";
      if (interval === 1) {
        base = days ? `Weekly on ${days}` : "Weekly";
      } else {
        base = days ? `Every ${interval} weeks on ${days}` : `Every ${interval} weeks`;
      }
      break;
    }

    case "monthly": {
      const dayStr = rule.dayOfMonth ? getOrdinalSuffix(rule.dayOfMonth) : "";
      if (interval === 1) {
        base = dayStr ? `Monthly on the ${dayStr}` : "Monthly";
      } else {
        base = dayStr ? `Every ${interval} months on the ${dayStr}` : `Every ${interval} months`;
      }
      break;
    }

    case "yearly": {
      const mStr = rule.monthOfYear ? MONTH_SHORT_NAMES[rule.monthOfYear] : "";
      const dayStr = rule.dayOfMonth ? getOrdinalSuffix(rule.dayOfMonth) : "";
      const dateSuffix = mStr && dayStr ? ` on ${mStr} ${dayStr}` : "";
      if (interval === 1) {
        base = `Yearly${dateSuffix}`;
      } else {
        base = `Every ${interval} years${dateSuffix}`;
      }
      break;
    }
  }

  if (rule.endDate) {
    return `${base} (until ${rule.endDate})`;
  }

  return base;
}
