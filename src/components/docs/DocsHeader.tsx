"use client";

import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import {
  CalendarDays,
  FileText,
  Sun,
  Moon,
  LogOut,
} from "lucide-react";

interface DocsHeaderProps {
  userEmail: string;
  isDarkMode: boolean;
  onToggleTheme: () => void;
}

export function DocsHeader({
  userEmail,
  isDarkMode,
  onToggleTheme,
}: DocsHeaderProps) {
  return (
    <header className="sticky top-0 z-30 px-4 sm:px-8 py-3.5 glass-panel border-b border-white/60 dark:border-slate-800/80 mb-6">
      <div className="w-full flex items-center justify-between gap-4">
        {/* Left: Brand Icon & Title + Nav Tabs */}
        <div className="flex items-center gap-3 sm:gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-500 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 flex-shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                Docs & Notes
              </h1>
            </div>
          </div>

          <nav className="flex items-center gap-1 p-1 rounded-2xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60">
            <Link
              href="/"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-all"
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Planner</span>
            </Link>
            <Link
              href="/docs"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs transition-all"
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Docs</span>
            </Link>
          </nav>
        </div>

        {/* Right Controls: Theme Toggle + User Avatar + Logout */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Theme Mode Toggle Button */}
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

          {/* Separator */}
          <div className="h-5 w-px bg-slate-200/80 dark:bg-slate-700/80 mx-1 hidden sm:block" />

          {/* User Avatar Circle */}
          <div
            className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 text-white font-bold text-xs flex items-center justify-center shadow-xs select-none uppercase flex-shrink-0"
            title={userEmail}
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
