"use client";

import { UserPreferences } from "@/db/schema";
import { ViewSettingsMenu } from "./ViewSettingsMenu";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface WeekNavControlsProps {
  isNavigating: boolean;
  preferences: UserPreferences;
  visibleDaysCount: number;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onGoToday: () => void;
  onToggleDay: (dayKey: "showSaturday" | "showSunday") => void;
}

export function WeekNavControls({
  isNavigating,
  preferences,
  visibleDaysCount,
  onPrevWeek,
  onNextWeek,
  onGoToday,
  onToggleDay,
}: WeekNavControlsProps) {
  return (
    <>
      {/* Week Navigation Controls */}
      <div className="flex items-center gap-1 sm:gap-1.5">
        <button
          type="button"
          onClick={onPrevWeek}
          disabled={isNavigating}
          className="p-2 rounded-xl bg-white/70 hover:bg-white dark:bg-slate-800/70 dark:hover:bg-slate-800 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white border border-slate-200/70 dark:border-slate-700/70 shadow-xs transition-all cursor-pointer disabled:opacity-50"
          title="Previous week"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onGoToday}
          disabled={isNavigating}
          className="px-3.5 py-1.5 rounded-xl bg-indigo-50/80 hover:bg-indigo-100/90 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-semibold text-xs border border-indigo-200/60 dark:border-indigo-800/60 shadow-xs transition-all cursor-pointer"
        >
          Today
        </button>

        <button
          type="button"
          onClick={onNextWeek}
          disabled={isNavigating}
          className="p-2 rounded-xl bg-white/70 hover:bg-white dark:bg-slate-800/70 dark:hover:bg-slate-800 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white border border-slate-200/70 dark:border-slate-700/70 shadow-xs transition-all cursor-pointer disabled:opacity-50"
          title="Next week"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* View Settings Popover */}
      <ViewSettingsMenu
        preferences={preferences}
        visibleDaysCount={visibleDaysCount}
        onToggleDay={onToggleDay}
      />
    </>
  );
}
