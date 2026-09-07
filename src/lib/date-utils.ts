export interface DayInfo {
  dateStr: string; // 'YYYY-MM-DD'
  dayName: string; // 'Monday', etc.
  dayNameShort: string; // 'Mon', 'Tue', etc.
  dayNumber: number; // 7, 8, etc.
  monthNameShort: string; // 'Sep', etc.
  isToday: boolean;
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
}

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const DAY_NAMES_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const MONTH_NAMES_SHORT = [
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

export function toDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateString(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function getMondayOfWeek(refDate: Date = new Date()): Date {
  const d = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

export function getWeekDays(monday: Date, todayStr?: string | null): DayInfo[] {
  const effectiveTodayStr = todayStr !== undefined ? todayStr : toDateString(new Date());
  const days: DayInfo[] = [];

  for (let i = 0; i < 7; i++) {
    const current = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    const dateStr = toDateString(current);
    const dayOfWeek = current.getDay();

    days.push({
      dateStr,
      dayName: DAY_NAMES[dayOfWeek],
      dayNameShort: DAY_NAMES_SHORT[dayOfWeek],
      dayNumber: current.getDate(),
      monthNameShort: MONTH_NAMES_SHORT[current.getMonth()],
      isToday: Boolean(effectiveTodayStr && dateStr === effectiveTodayStr),
      dayOfWeek,
    });
  }

  return days;
}

export function formatWeekRange(monday: Date): string {
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);

  const startDay = String(monday.getDate()).padStart(2, "0");
  const endDay = String(sunday.getDate()).padStart(2, "0");

  const startMonth = MONTH_NAMES[monday.getMonth()];
  const endMonth = MONTH_NAMES[sunday.getMonth()];

  const startYear = monday.getFullYear();
  const endYear = sunday.getFullYear();

  if (startYear !== endYear) {
    return `${startMonth} ${startDay}, ${startYear} – ${endMonth} ${endDay}, ${endYear}`;
  }

  if (startMonth !== endMonth) {
    return `${startMonth} ${startDay} – ${endMonth} ${endDay}, ${startYear}`;
  }

  return `${startMonth} ${startDay} – ${endDay}, ${startYear}`;
}

export function formatMonthYear(monday: Date): string {
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);

  const startMonth = MONTH_NAMES[monday.getMonth()];
  const endMonth = MONTH_NAMES[sunday.getMonth()];
  const startYear = monday.getFullYear();
  const endYear = sunday.getFullYear();

  if (startYear !== endYear) {
    return `${startMonth} ${startYear} / ${endMonth} ${endYear}`;
  }

  if (startMonth !== endMonth) {
    return `${startMonth} / ${endMonth}, ${startYear}`;
  }

  return `${startMonth}, ${startYear}`;
}

export function formatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || minutes <= 0) {
    return "";
  }

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours > 0 && mins === 0) {
    return `${hours}h`;
  }

  if (hours === 0 && mins > 0) {
    return `${mins}min`;
  }

  return `${hours}h ${mins}min`;
}

export function minutesToTimeString(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || minutes <= 0) {
    return "";
  }

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

export function timeStringToMinutes(timeStr: string | null | undefined): number | null {
  if (!timeStr || typeof timeStr !== "string") {
    return null;
  }

  const trimmed = timeStr.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  const hours = parseInt(match[1], 10);
  const mins = parseInt(match[2], 10);

  if (isNaN(hours) || isNaN(mins) || mins < 0 || mins > 59 || hours < 0) {
    return null;
  }

  const total = hours * 60 + mins;
  return total > 0 ? total : null;
}

export function parseNaturalDuration(input: string | null | undefined): number | null {
  if (!input || typeof input !== "string") return null;
  const str = input.trim().toLowerCase().replace(/,/g, ".");
  if (!str) return null;

  // Format "1:30", "0:45", "2:00", "01:30"
  const colonMatch = str.match(/^(\d{1,2}):(\d{1,2})$/);
  if (colonMatch) {
    const h = parseInt(colonMatch[1], 10);
    const m = parseInt(colonMatch[2], 10);
    if (!isNaN(h) && !isNaN(m) && m < 60) {
      const total = h * 60 + m;
      return total > 0 ? total : null;
    }
  }

  // Decimal hours format: "1.5h", "0.5h", "2.5h", "1.5 hours", "1.5 horas"
  const decimalHourMatch = str.match(/^(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours|hora|horas)$/);
  if (decimalHourMatch) {
    const hours = parseFloat(decimalHourMatch[1]);
    if (!isNaN(hours) && hours > 0) {
      return Math.round(hours * 60);
    }
  }

  // Combined format: "1h30", "1h 30m", "1h 30min", "2h 15min"
  const combinedMatch = str.match(
    /^(\d+)\s*(?:h|hr|hrs|hour|hours|hora|horas)\s*(\d+)?\s*(?:m|min|mins|minute|minutes|minuto|minutos)?$/
  );
  if (combinedMatch) {
    const h = parseInt(combinedMatch[1], 10);
    const m = combinedMatch[2] ? parseInt(combinedMatch[2], 10) : 0;
    if (!isNaN(h) && !isNaN(m)) {
      const total = h * 60 + m;
      return total > 0 ? total : null;
    }
  }

  // Minutes only format: "30m", "30min", "45 mins", "15 minutes"
  const minutesOnlyMatch = str.match(/^(\d+)\s*(?:m|min|mins|minute|minutes|minuto|minutos)$/);
  if (minutesOnlyMatch) {
    const m = parseInt(minutesOnlyMatch[1], 10);
    return !isNaN(m) && m > 0 ? m : null;
  }

  // Pure numbers without unit
  const pureNumMatch = str.match(/^(\d+(?:\.\d+)?)$/);
  if (pureNumMatch) {
    const val = parseFloat(pureNumMatch[1]);
    if (!isNaN(val) && val > 0) {
      if (str.includes(".")) {
        return Math.round(val * 60);
      }
      if (val <= 12) {
        return Math.round(val * 60);
      }
      return Math.round(val);
    }
  }

  return null;
}

export function formatDayShort(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return dateStr;
  const [year, month, day] = parts;
  const d = new Date(year, month - 1, day);
  const dayOfWeek = d.getDay();
  return `${DAY_NAMES_SHORT[dayOfWeek]}, ${MONTH_NAMES_SHORT[month - 1]} ${day}`;
}
