export interface TagColorOption {
  key: string;
  label: string;
  badgeClass: string;
  dotClass: string;
  borderClass: string;
}

export const TAG_COLORS: Record<string, TagColorOption> = {
  indigo: {
    key: "indigo",
    label: "Índigo",
    badgeClass: "bg-indigo-50 text-indigo-700 border-indigo-200/70",
    dotClass: "bg-indigo-500",
    borderClass: "border-indigo-400",
  },
  violet: {
    key: "violet",
    label: "Violeta",
    badgeClass: "bg-violet-50 text-violet-700 border-violet-200/70",
    dotClass: "bg-violet-500",
    borderClass: "border-violet-400",
  },
  emerald: {
    key: "emerald",
    label: "Esmeralda",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200/70",
    dotClass: "bg-emerald-500",
    borderClass: "border-emerald-400",
  },
  amber: {
    key: "amber",
    label: "Âmbar",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200/70",
    dotClass: "bg-amber-500",
    borderClass: "border-amber-400",
  },
  rose: {
    key: "rose",
    label: "Rosa",
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200/70",
    dotClass: "bg-rose-500",
    borderClass: "border-rose-400",
  },
  sky: {
    key: "sky",
    label: "Céu",
    badgeClass: "bg-sky-50 text-sky-700 border-sky-200/70",
    dotClass: "bg-sky-500",
    borderClass: "border-sky-400",
  },
  orange: {
    key: "orange",
    label: "Laranja",
    badgeClass: "bg-orange-50 text-orange-700 border-orange-200/70",
    dotClass: "bg-orange-500",
    borderClass: "border-orange-400",
  },
  slate: {
    key: "slate",
    label: "Ardósia",
    badgeClass: "bg-slate-100 text-slate-700 border-slate-200/70",
    dotClass: "bg-slate-500",
    borderClass: "border-slate-400",
  },
};

export const DEFAULT_TAG_COLOR = TAG_COLORS.indigo;

export function getTagColorStyles(colorKey?: string | null): TagColorOption {
  if (!colorKey || !TAG_COLORS[colorKey]) {
    return DEFAULT_TAG_COLOR;
  }
  return TAG_COLORS[colorKey];
}
