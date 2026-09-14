"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/actions/auth";
import {
  CalendarDays,
  FileText,
  Sun,
  Moon,
  LogOut,
} from "lucide-react";
import { BackgroundThemeId, UserPreferences } from "@/db/schema";
import { SettingsMenu } from "./board/SettingsMenu";

export interface AppHeaderProps {
  title?: React.ReactNode;
  userEmail: string;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  preferences?: UserPreferences;
  visibleDaysCount?: number;
  onToggleDay?: (dayKey: "showSaturday" | "showSunday") => void;
  onSelectBackground?: (bgId: BackgroundThemeId) => void;
  children?: React.ReactNode;
}

export function AppHeader({
  title,
  userEmail,
  isDarkMode,
  onToggleTheme,
  preferences,
  visibleDaysCount,
  onToggleDay,
  onSelectBackground,
  children,
}: AppHeaderProps) {
  const pathname = usePathname();
  const isPlannerActive = pathname === "/";
  const isDocsActive = pathname.startsWith("/docs");

  const displayTitle = title ?? (isDocsActive ? "Docs & Notes" : "");

  return (
    <header className="sticky top-0 z-30 px-3.5 sm:px-6 md:px-8 py-2.5 sm:py-3.5 glass-panel border-b border-white/60 dark:border-slate-800/80 mb-4 sm:mb-6">
      <div className="w-full grid grid-cols-[1fr_auto] items-center gap-y-2.5 gap-x-2 md:flex md:items-center md:justify-between md:gap-4">
        {/* Brand Icon & Title: Row 1 Left on mobile, Order 1 on desktop */}
        <div className="row-start-1 col-start-1 flex items-center gap-2.5 sm:gap-3 min-w-0 md:order-1">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-600 text-white flex items-center justify-center shadow-md shadow-amber-500/20 flex-shrink-0">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            {typeof displayTitle === "string" ? (
              <h1 className="text-sm sm:text-base md:text-lg font-bold text-slate-800 dark:text-slate-100 tracking-tight truncate">
                {displayTitle}
              </h1>
            ) : (
              displayTitle
            )}
          </div>
        </div>

        {/* View Switcher Nav Tabs: Row 2 Left on mobile, Order 2 on desktop */}
        <div className="row-start-2 col-start-1 flex items-center md:order-2 md:mr-auto">
          <nav className="flex items-center gap-1 p-1 rounded-2xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 shrink-0">
            <Link
              href="/"
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs transition-all ${
                isPlannerActive
                  ? "font-semibold bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-2xs"
                  : "font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span className="inline">Planner</span>
            </Link>
            <Link
              href="/docs"
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs transition-all ${
                isDocsActive
                  ? "font-semibold bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-2xs"
                  : "font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="inline">Docs</span>
            </Link>
          </nav>
        </div>

        {/* Context Controls (e.g. WeekNavControls): Row 2 Right on mobile, Order 3 on desktop */}
        {children && (
          <div className="row-start-2 col-start-2 justify-self-end flex items-center md:order-3">
            {children}
          </div>
        )}

        {/* System Controls: Row 1 Right on mobile, Order 4 on desktop */}
        <div className="row-start-1 col-start-2 justify-self-end flex items-center gap-1.5 sm:gap-2 md:gap-3 md:order-4">
          {/* Settings Menu Button */}
          {preferences && onSelectBackground && (
            <SettingsMenu
              preferences={preferences}
              visibleDaysCount={visibleDaysCount}
              onToggleDay={onToggleDay}
              onSelectBackground={onSelectBackground}
            />
          )}

          {/* Quick Dark Mode Toggle Button */}
          <button
            type="button"
            onClick={onToggleTheme}
            className="p-2 rounded-xl bg-white/70 hover:bg-white dark:bg-slate-800/70 dark:hover:bg-slate-800 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white border border-slate-200/70 dark:border-slate-700/70 shadow-xs transition-all cursor-pointer flex items-center justify-center group"
            title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
            aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDarkMode ? (
              <Sun className="w-4 h-4 text-amber-400 group-hover:rotate-45 transition-transform duration-300" />
            ) : (
              <Moon className="w-4 h-4 text-slate-600 group-hover:-rotate-12 transition-transform duration-300" />
            )}
          </button>

          {/* Separator (visible on desktop) */}
          <div className="h-5 w-px bg-slate-200/80 dark:bg-slate-700/80 mx-0.5 hidden sm:block" />

          {/* User Avatar Circle */}
          <div
            className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-amber-600 text-white font-bold text-xs flex items-center justify-center shadow-xs select-none uppercase flex-shrink-0"
            title={userEmail}
            aria-label={`Logged in as ${userEmail}`}
          >
            {userEmail ? userEmail.charAt(0).toUpperCase() : "U"}
          </div>

          {/* Logout Button */}
          <form action={logoutAction}>
            <button
              type="submit"
              className="p-2 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 bg-white/60 hover:bg-rose-50/80 dark:bg-slate-800/60 dark:hover:bg-rose-950/50 rounded-xl border border-slate-200/70 dark:border-slate-700/70 transition-colors cursor-pointer flex items-center justify-center"
              title="Log out"
              aria-label="Log out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
