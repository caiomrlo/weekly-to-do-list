export interface ProjectColorOption {
  key: string;
  label: string;
  badgeClass: string;
  dotClass: string;
  borderClass: string;
}

export const PROJECT_COLORS: Record<string, ProjectColorOption> = {
  indigo: {
    key: "indigo",
    label: "Indigo",
    badgeClass: "bg-indigo-50 text-indigo-700 border-indigo-200/70 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800/60",
    dotClass: "bg-indigo-500",
    borderClass: "border-indigo-400",
  },
  violet: {
    key: "violet",
    label: "Violet",
    badgeClass: "bg-violet-50 text-violet-700 border-violet-200/70 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-800/60",
    dotClass: "bg-violet-500",
    borderClass: "border-violet-400",
  },
  emerald: {
    key: "emerald",
    label: "Emerald",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200/70 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60",
    dotClass: "bg-emerald-500",
    borderClass: "border-emerald-400",
  },
  amber: {
    key: "amber",
    label: "Amber",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200/70 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/60",
    dotClass: "bg-amber-500",
    borderClass: "border-amber-400",
  },
  rose: {
    key: "rose",
    label: "Rose",
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200/70 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/60",
    dotClass: "bg-rose-500",
    borderClass: "border-rose-400",
  },
  sky: {
    key: "sky",
    label: "Sky",
    badgeClass: "bg-sky-50 text-sky-700 border-sky-200/70 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800/60",
    dotClass: "bg-sky-500",
    borderClass: "border-sky-400",
  },
  orange: {
    key: "orange",
    label: "Orange",
    badgeClass: "bg-orange-50 text-orange-700 border-orange-200/70 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800/60",
    dotClass: "bg-orange-500",
    borderClass: "border-orange-400",
  },
  slate: {
    key: "slate",
    label: "Slate",
    badgeClass: "bg-slate-100 text-slate-700 border-slate-200/70 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700/70",
    dotClass: "bg-slate-500",
    borderClass: "border-slate-400",
  },
};

export const DEFAULT_PROJECT_COLOR = PROJECT_COLORS.indigo;

export function getProjectColorStyles(colorKey?: string | null): ProjectColorOption {
  if (!colorKey || !PROJECT_COLORS[colorKey]) {
    return DEFAULT_PROJECT_COLOR;
  }
  return PROJECT_COLORS[colorKey];
}
