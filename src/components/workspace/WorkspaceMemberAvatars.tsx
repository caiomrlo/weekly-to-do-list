"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus } from "lucide-react";
import {
  getWorkspaceMembersAction,
  WorkspaceMemberItem,
} from "@/app/actions/workspace-invites";
import { WorkspaceInvitePopover } from "./WorkspaceInvitePopover";
import { UserAvatar } from "@/components/shared/UserAvatar";

export interface WorkspaceMemberAvatarsProps {
  workspaceId?: string;
  workspaceName?: string;
}

export function WorkspaceMemberAvatars({
  workspaceId,
  workspaceName,
}: WorkspaceMemberAvatarsProps) {
  const [members, setMembers] = useState<WorkspaceMemberItem[]>([]);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const refreshMembers = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  useEffect(() => {
    let isMounted = true;
    if (!workspaceId) return;

    void (async () => {
      try {
        const res = await getWorkspaceMembersAction(workspaceId);
        if (isMounted && res.members) {
          setMembers(res.members);
        }
      } catch (err) {
        console.error("Failed to load workspace members:", err);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [workspaceId, refreshTrigger]);

  const displayedMembers = members.slice(0, 4);
  const remainingCount = Math.max(0, members.length - 4);

  return (
    <div className="relative">
      <div className="flex items-center" aria-label="Workspace members">
        <div className="flex items-center -space-x-1.5 sm:-space-x-2">
          {displayedMembers.map((member) => (
            <div
              key={member.id}
              onClick={() => setIsPopoverOpen((prev) => !prev)}
              className="relative group transition-transform hover:scale-110 hover:z-20 cursor-pointer"
            >
              <UserAvatar
                size="md"
                name={member.name}
                email={member.email}
                image={member.image}
                color={member.avatarColor}
                userId={member.userId}
                title={`${member.name} (${member.isOwner ? "Owner" : "Member"})`}
              />
            </div>
          ))}

          {/* Overflow Pill */}
          {remainingCount > 0 && (
            <div
              onClick={() => setIsPopoverOpen((prev) => !prev)}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 border-white dark:border-neutral-900 bg-slate-200 dark:bg-neutral-700 text-slate-700 dark:text-slate-200 text-[10px] sm:text-xs font-bold flex items-center justify-center shadow-2xs cursor-pointer hover:scale-110 hover:z-20 transition-transform"
              title={`${remainingCount} more member${
                remainingCount > 1 ? "s" : ""
              }`}
            >
              +{remainingCount}
            </div>
          )}

          {/* Add / Invite Member Button */}
          <button
            type="button"
            onClick={() => setIsPopoverOpen((prev) => !prev)}
            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 transition-all shadow-2xs flex items-center justify-center cursor-pointer group ${
              isPopoverOpen
                ? "border-amber-500 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 scale-110 z-20"
                : "border-white dark:border-neutral-900 bg-white/90 hover:bg-white dark:bg-neutral-800 dark:hover:bg-neutral-700 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:scale-110 hover:z-20"
            }`}
            title="Invite members to workspace"
            aria-label="Invite members to workspace"
            aria-haspopup="dialog"
            aria-expanded={isPopoverOpen}
          >
            <Plus
              className={`w-3.5 h-3.5 transition-transform duration-200 ${
                isPopoverOpen
                  ? "rotate-45 text-amber-600 dark:text-amber-400"
                  : "group-hover:rotate-90"
              }`}
            />
          </button>
        </div>
      </div>

      {workspaceId && (
        <WorkspaceInvitePopover
          isOpen={isPopoverOpen}
          onClose={() => {
            setIsPopoverOpen(false);
            refreshMembers();
          }}
          workspaceId={workspaceId}
          workspaceName={workspaceName}
          onMembersUpdated={refreshMembers}
        />
      )}
    </div>
  );
}
