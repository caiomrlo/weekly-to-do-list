export interface StatusColorOption {
  key: string;
  label: string;
  badgeClass: string;
  dotClass: string;
  borderClass: string;
  headerBgClass: string;
}

export const STATUS_COLORS: Record<string, StatusColorOption> = {
  slate: {
    key: 'slate',
    label: 'Slate',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200/80 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700/80',
    dotClass: 'bg-slate-400 dark:bg-slate-500',
    borderClass: 'border-slate-400',
    headerBgClass: 'bg-slate-100/70 dark:bg-slate-800/60',
  },
  amber: {
    key: 'amber',
    label: 'Amber',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200/70 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/60',
    dotClass: 'bg-amber-500',
    borderClass: 'border-amber-400',
    headerBgClass: 'bg-amber-50/70 dark:bg-amber-950/40',
  },
  emerald: {
    key: 'emerald',
    label: 'Emerald',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/70 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60',
    dotClass: 'bg-emerald-500',
    borderClass: 'border-emerald-400',
    headerBgClass: 'bg-emerald-50/70 dark:bg-emerald-950/40',
  },
  indigo: {
    key: 'indigo',
    label: 'Indigo',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200/70 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800/60',
    dotClass: 'bg-indigo-500',
    borderClass: 'border-indigo-400',
    headerBgClass: 'bg-indigo-50/70 dark:bg-indigo-950/40',
  },
  violet: {
    key: 'violet',
    label: 'Violet',
    badgeClass: 'bg-violet-50 text-violet-700 border-violet-200/70 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-800/60',
    dotClass: 'bg-violet-500',
    borderClass: 'border-violet-400',
    headerBgClass: 'bg-violet-50/70 dark:bg-violet-950/40',
  },
  rose: {
    key: 'rose',
    label: 'Rose',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200/70 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/60',
    dotClass: 'bg-rose-500',
    borderClass: 'border-rose-400',
    headerBgClass: 'bg-rose-50/70 dark:bg-rose-950/40',
  },
  sky: {
    key: 'sky',
    label: 'Sky',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200/70 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800/60',
    dotClass: 'bg-sky-500',
    borderClass: 'border-sky-400',
    headerBgClass: 'bg-sky-50/70 dark:bg-sky-950/40',
  },
  orange: {
    key: 'orange',
    label: 'Orange',
    badgeClass: 'bg-orange-50 text-orange-700 border-orange-200/70 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800/60',
    dotClass: 'bg-orange-500',
    borderClass: 'border-orange-400',
    headerBgClass: 'bg-orange-50/70 dark:bg-orange-950/40',
  },
};

export const STATUS_CATEGORY_LABELS: Record<string, string> = {
  todo: 'To Do',
  doing: 'Doing',
  done: 'Done',
};

import { TaskStatusCategory } from "@/db/schema";

export const DEFAULT_STATUSES: Array<{
  name: string;
  color: string;
  category: TaskStatusCategory;
  order: number;
  isDefault: boolean;
}> = [
  { name: "To Do", color: "slate", category: "todo", order: 0, isDefault: true },
  { name: "Doing", color: "amber", category: "doing", order: 1, isDefault: true },
  { name: "Done", color: "emerald", category: "done", order: 2, isDefault: true },
];

export function getStatusStyles(colorKey?: string | null): StatusColorOption {
  if (!colorKey || !STATUS_COLORS[colorKey]) {
    return STATUS_COLORS.slate;
  }
  return STATUS_COLORS[colorKey];
}
