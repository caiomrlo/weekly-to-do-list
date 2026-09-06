"use client";

import { UserPreferences } from "@/db/schema";
import { formatMonthYear } from "@/lib/date-utils";
import { logoutAction } from "@/app/actions/auth";
import { ViewSettingsMenu } from "./ViewSettingsMenu";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  LogOut,
} from "lucide-react";

interface WeeklyHeaderProps {
  currentMonday: Date;
  userEmail: string;
  isNavigating: boolean;
  isDarkMode: boolean;
  preferences: UserPreferences;
  visibleDaysCount: number;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onGoToday: () => void;
  onToggleTheme: () => void;
  onToggleDay: (dayKey: "showSaturday" | "showSunday") => void;
}

export function WeeklyHeader({
  currentMonday,
  userEmail,
  isNavigating,
  isDarkMode,
  preferences,
  visibleDaysCount,
  onPrevWeek,
  onNextWeek,
  onGoToday,
  onToggleTheme,
  onToggleDay,
}: WeeklyHeaderProps) {
  return (
    <header className="sticky top-0 z-30 px-4 sm:px-8 py-3.5 glass-panel border-b border-white/60 dark:border-slate-800/80 mb-6">
      <div className="w-full flex items-center justify-between gap-4">
        {/* Month & Year Title (Left) */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 flex-shrink-0">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 tracking-tight">
              {formatMonthYear(currentMonday)}
            </h1>
          </div>
        </div>

        {/* Right Controls: Week Navigation + Theme Toggle + User Avatar Circle + Logout */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Week Navigation Controls */}
          <div className="flex items-center gap-1 sm:gap-1.5">
            <button
              type="button"
              onClick={onPrevWeek}
              disabled={isNavigating}
              className="p-2 rounded-xl bg-white/70 hover:bg-white dark:bg-slate-800/70 dark:hover:bg-slate-800 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white border border-slate-200/70 dark:border-slate-700/70 shadow-xs transition-all cursor-pointer disabled:opacity-50"
              title="Semana anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onGoToday}
              disabled={isNavigating}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-50/80 hover:bg-indigo-100/90 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-semibold text-xs border border-indigo-200/60 dark:border-indigo-800/60 shadow-xs transition-all cursor-pointer"
            >
              Hoje
            </button>

            <button
              type="button"
              onClick={onNextWeek}
              disabled={isNavigating}
              className="p-2 rounded-xl bg-white/70 hover:bg-white dark:bg-slate-800/70 dark:hover:bg-slate-800 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white border border-slate-200/70 dark:border-slate-700/70 shadow-xs transition-all cursor-pointer disabled:opacity-50"
              title="Próxima semana"
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

          {/* Quick Dark Mode Toggle Button */}
          <button
            type="button"
            onClick={onToggleTheme}
            className="p-2 rounded-xl bg-white/70 hover:bg-white dark:bg-slate-800/70 dark:hover:bg-slate-800 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white border border-slate-200/70 dark:border-slate-700/70 shadow-xs transition-all cursor-pointer flex items-center justify-center group"
            title={isDarkMode ? "Mudar para modo claro" : "Mudar para modo escuro"}
            aria-label={isDarkMode ? "Mudar para modo claro" : "Mudar para modo escuro"}
          >
            {isDarkMode ? (
              <Sun className="w-4 h-4 text-amber-400 group-hover:rotate-45 transition-transform duration-300" />
            ) : (
              <Moon className="w-4 h-4 text-slate-600 group-hover:-rotate-12 transition-transform duration-300" />
            )}
          </button>

          {/* Separator */}
          <div className="h-5 w-px bg-slate-200/80 dark:bg-slate-700/80 mx-1 hidden sm:block" />

          {/* User Avatar Circle */}
          <div
            className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 text-white font-bold text-xs flex items-center justify-center shadow-xs select-none uppercase flex-shrink-0"
            title={userEmail}
          >
            {userEmail ? userEmail.charAt(0).toUpperCase() : "U"}
          </div>

          {/* Logout Button (Icon only) */}
          <form action={logoutAction}>
            <button
              type="submit"
              className="p-2 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 bg-white/60 hover:bg-rose-50/80 dark:bg-slate-800/60 dark:hover:bg-rose-950/50 rounded-xl border border-slate-200/70 dark:border-slate-700/70 transition-colors cursor-pointer flex items-center justify-center"
              title="Encerrar sessão"
              aria-label="Encerrar sessão"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
