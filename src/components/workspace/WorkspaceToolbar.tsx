"use client";

import { Workspace } from "@/db/schema";
import { WorkspaceSelector } from "./WorkspaceSelector";
import { WorkspaceMemberAvatars } from "./WorkspaceMemberAvatars";

export interface WorkspaceToolbarProps {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  displayTitle?: React.ReactNode;
  children?: React.ReactNode;
}

export function WorkspaceToolbar({
  workspaces,
  activeWorkspaceId,
  displayTitle,
  children,
}: WorkspaceToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-3 sm:gap-4 flex-wrap w-full py-1">
      {/* Left: Workspace Selector + Separator + Member Avatars */}
      <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
        <WorkspaceSelector
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
        />

        {/* Subtle Vertical Divider */}
        <div
          className="h-6 w-px bg-slate-200/80 dark:bg-slate-700/80 shrink-0"
          aria-hidden="true"
        />

        {/* Member Avatars Stack */}
        <WorkspaceMemberAvatars />
      </div>

      {/* Right: Contextual Controls & Display Title */}
      {(displayTitle || children) && (
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0 ml-auto">
          {displayTitle && (
            <div className="hidden sm:flex items-center text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 tracking-tight">
              {displayTitle}
            </div>
          )}
          {children}
        </div>
      )}
    </div>
  );
}
