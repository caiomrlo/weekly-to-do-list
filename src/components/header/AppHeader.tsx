"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Sun,
  Moon,
} from "lucide-react";
import { BackgroundThemeId, UserPreferences, Workspace } from "@/db/schema";
import { SettingsMenu } from "./SettingsMenu";
import { NavTabs } from "./NavTabs";
import { ProfileMenu } from "./ProfileMenu";
import { WorkspaceToolbar } from "@/components/workspace/WorkspaceToolbar";

export interface AppHeaderProps {
  title?: React.ReactNode;
  userEmail: string;
  userName?: string;
  userImage?: string | null;
  userAvatarColor?: string | null;
  userId?: string;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  preferences?: UserPreferences;
  visibleDaysCount?: number;
  onToggleDay?: (dayKey: "showSaturday" | "showSunday") => void;
  onSelectBackground?: (bgId: BackgroundThemeId) => void;
  workspaces?: Workspace[];
  activeWorkspaceId?: string;
  children?: React.ReactNode;
}

export function AppHeader({
  title,
  userEmail,
  userName,
  userImage,
  userAvatarColor,
  userId,
  isDarkMode,
  onToggleTheme,
  preferences,
  visibleDaysCount,
  onToggleDay,
  onSelectBackground,
  workspaces,
  activeWorkspaceId,
  children,
}: AppHeaderProps) {
  const pathname = usePathname();
  const isKanbanActive = pathname.startsWith("/kanban");
  const isDocsActive = pathname.startsWith("/docs");
  const isAgentActive = pathname.startsWith("/agent");

  const displayTitle =
    title ??
    (isDocsActive
      ? "Docs & Notes"
      : isKanbanActive
      ? "Kanban"
      : isAgentActive
      ? "AI Agent"
      : "");

  return (
    <header className="sticky top-0 z-30 w-full mb-4 sm:mb-6 backdrop-blur-xl bg-white/75 dark:bg-neutral-900/80 border-b border-white/60 dark:border-neutral-800/80 shadow-xs transition-colors">
      {/* Tier 1: Main Application Header (Brand, Navigation Views, System Controls) */}
      <div className="px-3.5 sm:px-6 md:px-8 py-2 sm:py-2.5 flex items-center justify-between gap-3 sm:gap-4 border-b border-slate-200/50 dark:border-neutral-800/50">
        {/* Left: Brand Icon + View Switcher Tabs */}
        <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
          <Link
            href="/"
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-600 text-white flex items-center justify-center shadow-md shadow-amber-500/20 shrink-0 hover:opacity-95 transition-opacity"
            aria-label="Weekly Planner Home"
          >
            <CalendarDays className="w-5 h-5" />
          </Link>

          {/* View Switcher Nav Tabs */}
          <NavTabs />
        </div>

        {/* Right: System Controls (Theme, Settings, Profile, Logout) */}
        <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 shrink-0">
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
            className="p-2 rounded-xl bg-white/70 hover:bg-white dark:bg-neutral-800/70 dark:hover:bg-neutral-800 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white border border-slate-200/70 dark:border-neutral-700/70 shadow-xs transition-all cursor-pointer flex items-center justify-center group"
            title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
            aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDarkMode ? (
              <Sun className="w-4 h-4 text-amber-400 group-hover:text-amber-500 dark:group-hover:text-amber-300 transition-colors duration-200" />
            ) : (
              <Moon className="w-4 h-4 text-slate-600 group-hover:text-slate-900 dark:text-slate-300 dark:group-hover:text-white transition-colors duration-200" />
            )}
          </button>

          {/* Separator (visible on desktop) */}
          <div className="h-5 w-px bg-slate-200/80 dark:bg-neutral-700/80 mx-0.5 hidden sm:block" />

          {/* User Profile Popover Menu */}
          <ProfileMenu
            userEmail={userEmail}
            userName={userName}
            userImage={userImage}
            userAvatarColor={userAvatarColor}
            userId={userId}
          />
        </div>
      </div>

      {/* Tier 2: Workspace Toolbar (Workspace Selector, Members, Contextual Actions) */}
      {workspaces && activeWorkspaceId && (
        <div className="px-3.5 sm:px-6 md:px-8 py-2 sm:py-2.5">
          <WorkspaceToolbar
            workspaces={workspaces}
            activeWorkspaceId={activeWorkspaceId}
            displayTitle={displayTitle}
          >
            {children}
          </WorkspaceToolbar>
        </div>
      )}
    </header>
  );
}
