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
 */
export function getWeekDays(monday: Date): DayInfo[] {
  const todayStr = toDateString(new Date());
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
      isToday: dateStr === todayStr,
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
