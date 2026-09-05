/**
 * Utilitários para manipulação de datas no calendário semanal.
 * Baseados no formato ISO 'YYYY-MM-DD' para total imunidade a desvios de timezone.
 */

export interface DayInfo {
  dateStr: string; // 'YYYY-MM-DD'
  dayName: string; // 'Segunda-feira', etc.
  dayNameShort: string; // 'Seg', 'Ter', etc.
  dayNumber: number; // 7, 8, etc.
  monthNameShort: string; // 'set.', etc.
  isToday: boolean;
  dayOfWeek: number; // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
}

const DAY_NAMES = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

const DAY_NAMES_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const MONTH_NAMES_SHORT = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
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

/**
 * Retorna a Segunda-feira da semana de uma data de referência.
 */
export function getMondayOfWeek(refDate: Date = new Date()): Date {
  const d = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());
  const day = d.getDay();
  // Se domingo (0), subtrai 6 dias. Caso contrário, subtrai (day - 1) dias.
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

/**
 * Retorna os 7 dias da semana (Segunda a Domingo) a partir de uma data de Segunda-feira.
 * @param monday - Data da Segunda-feira
 * @param todayStr - Opcional string 'YYYY-MM-DD' para definir o dia atual. Se null ou "", nenhum dia será marcado como hoje (ideal para SSR/hidratação limpa). Se undefined, calcula via new Date().
 */
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

/**
 * Formata o intervalo da semana para exibição amigável no cabeçalho.
 * Ex: "07 de Setembro – 13 de Setembro de 2026"
 */
export function formatWeekRange(monday: Date): string {
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);

  const startDay = String(monday.getDate()).padStart(2, "0");
  const endDay = String(sunday.getDate()).padStart(2, "0");

  const startMonth = MONTH_NAMES[monday.getMonth()];
  const endMonth = MONTH_NAMES[sunday.getMonth()];

  const startYear = monday.getFullYear();
  const endYear = sunday.getFullYear();

  if (startYear !== endYear) {
    return `${startDay} de ${startMonth} de ${startYear} – ${endDay} de ${endMonth} de ${endYear}`;
  }

  if (startMonth !== endMonth) {
    return `${startDay} de ${startMonth} – ${endDay} de ${endMonth} de ${startYear}`;
  }

  return `${startDay} a ${endDay} de ${startMonth} de ${startYear}`;
}

/**
 * Formata o mês e ano da semana atual para exibição no cabeçalho.
 * Ex: "Julho, 2026" ou "Agosto / Setembro, 2026"
 */
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

/**
 * Formata a duração em minutos de forma simplificada e legível.
 * Exemplos:
 *  - 60 -> "1h"
 *  - 120 -> "2h"
 *  - 30 -> "30min"
 *  - 90 -> "1h 30min"
 *  - 75 -> "1h 15min"
 */
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

/**
 * Converte minutos inteiros para string no formato "HH:mm" (usado por inputs de hora).
 * Exemplos:
 *  - 60 -> "01:00"
 *  - 30 -> "00:30"
 *  - 90 -> "01:30"
 */
export function minutesToTimeString(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || minutes <= 0) {
    return "";
  }

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

/**
 * Converte string no formato "HH:mm" ou "H:mm" para minutos inteiros.
 * Exemplos:
 *  - "01:00" ou "1:00" -> 60
 *  - "00:30" ou "0:30" -> 30
 *  - "01:30" ou "1:30" -> 90
 */
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

/**
 * Converte entradas em linguagem natural ou abreviada para minutos inteiros.
 * Exemplos aceitos:
 *  - "30", "30m", "30min", "30 minutos" -> 30
 *  - "1h", "1 h", "1 hora", "1hr" -> 60
 *  - "1:30", "1h30", "1h 30m", "1h 30min", "1.5h", "1,5h" -> 90
 *  - "2h", "2:00", "2 hrs" -> 120
 *  - "2h15", "2h 15m" -> 135
 *  - "" ou inválido -> null
 */
export function parseNaturalDuration(input: string | null | undefined): number | null {
  if (!input || typeof input !== "string") return null;
  const str = input.trim().toLowerCase().replace(/,/g, ".");
  if (!str) return null;

  // Formato "1:30", "0:45", "2:00", "01:30"
  const colonMatch = str.match(/^(\d{1,2}):(\d{1,2})$/);
  if (colonMatch) {
    const h = parseInt(colonMatch[1], 10);
    const m = parseInt(colonMatch[2], 10);
    if (!isNaN(h) && !isNaN(m) && m < 60) {
      const total = h * 60 + m;
      return total > 0 ? total : null;
    }
  }

  // Formato decimal de horas: "1.5h", "0.5h", "2.5h", "1.5 horas"
  const decimalHourMatch = str.match(/^(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hora|horas)$/);
  if (decimalHourMatch) {
    const hours = parseFloat(decimalHourMatch[1]);
    if (!isNaN(hours) && hours > 0) {
      return Math.round(hours * 60);
    }
  }

  // Formato composto: "1h30", "1h 30m", "1h 30min", "2h 15min"
  const combinedMatch = str.match(
    /^(\d+)\s*(?:h|hr|hrs|hora|horas)\s*(\d+)?\s*(?:m|min|mins|minuto|minutos)?$/
  );
  if (combinedMatch) {
    const h = parseInt(combinedMatch[1], 10);
    const m = combinedMatch[2] ? parseInt(combinedMatch[2], 10) : 0;
    if (!isNaN(h) && !isNaN(m)) {
      const total = h * 60 + m;
      return total > 0 ? total : null;
    }
  }

  // Formato apenas minutos: "30m", "30min", "45 mins", "15 minutos"
  const minutesOnlyMatch = str.match(/^(\d+)\s*(?:m|min|mins|minuto|minutos)$/);
  if (minutesOnlyMatch) {
    const m = parseInt(minutesOnlyMatch[1], 10);
    return !isNaN(m) && m > 0 ? m : null;
  }

  // Apenas números puros sem unidade
  const pureNumMatch = str.match(/^(\d+(?:\.\d+)?)$/);
  if (pureNumMatch) {
    const val = parseFloat(pureNumMatch[1]);
    if (!isNaN(val) && val > 0) {
      if (str.includes(".")) {
        // Ex: "1.5" -> 90 min, "0.5" -> 30 min
        return Math.round(val * 60);
      }
      if (val <= 12) {
        // Ex: "1" -> 60 min (1h), "2" -> 120 min (2h)
        return Math.round(val * 60);
      }
      // Ex: "15", "30", "45", "90" -> minutos
      return Math.round(val);
    }
  }

  return null;
}


