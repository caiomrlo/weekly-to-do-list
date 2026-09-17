"use client";

import { useEffect, useRef, useState } from "react";
import { TaskAssigneeUser } from "@/db/schema";
import {
  getWorkspaceMembersAction,
  WorkspaceMemberItem,
} from "@/app/actions/workspace-invites";
import { updateTaskAssigneesAction } from "@/app/actions/tasks";
import { UserAvatar } from "@/components/shared/UserAvatar";
import {
  UserPlus,
  ChevronDown,
  Check,
  Search,
  Loader2,
} from "lucide-react";

export interface TaskAssigneeSelectorProps {
  taskId: string;
  workspaceId: string;
  assignees: TaskAssigneeUser[];
  onAssigneesChange: (assignees: TaskAssigneeUser[]) => void;
}

export function TaskAssigneeSelector({
  taskId,
  workspaceId,
  assignees,
  onAssigneesChange,
}: TaskAssigneeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [members, setMembers] = useState<WorkspaceMemberItem[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isTogglingId, setIsTogglingId] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setSearchQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleOpenClick = () => {
    const next = !isOpen;
    setIsOpen(next);
    if (next && members.length === 0 && workspaceId) {
      setIsLoadingMembers(true);
      getWorkspaceMembersAction(workspaceId)
        .then((res) => {
          if (res.members) {
            setMembers(res.members);
          }
        })
        .catch((err) => {
          console.error("Failed to load workspace members for assignees:", err);
        })
        .finally(() => {
          setIsLoadingMembers(false);
        });
    }
  };

  const assignedUserIds = new Set(assignees.map((a) => a.id));

  const handleToggleMember = async (member: WorkspaceMemberItem) => {
    const isAssigned = assignedUserIds.has(member.userId);
    let updatedAssignees: TaskAssigneeUser[];
    let nextUserIds: string[];

    if (isAssigned) {
      updatedAssignees = assignees.filter((a) => a.id !== member.userId);
      nextUserIds = updatedAssignees.map((a) => a.id);
    } else {
      const newAssignee: TaskAssigneeUser = {
        id: member.userId,
        name: member.name,
        email: member.email,
        image: member.image,
        avatarColor: member.avatarColor,
      };
      updatedAssignees = [...assignees, newAssignee];
      nextUserIds = [...assignees.map((a) => a.id), member.userId];
    }

    // Optimistically update
    onAssigneesChange(updatedAssignees);
    setIsTogglingId(member.userId);

    try {
      const res = await updateTaskAssigneesAction(taskId, nextUserIds);
      if (res.assignees) {
        onAssigneesChange(res.assignees);
      } else if (res.error) {
        // Rollback on error
        onAssigneesChange(assignees);
      }
    } catch (err) {
      console.error("Failed to update task assignees:", err);
      onAssigneesChange(assignees);
    } finally {
      setIsTogglingId(null);
    }
  };

  const filteredMembers = members.filter((m) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
    );
  });

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={handleOpenClick}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium bg-slate-100/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 border border-slate-200/70 dark:border-slate-700/70 transition-all shadow-2xs cursor-pointer group"
        title="Assign members"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {assignees.length === 0 ? (
          <>
            <UserPlus className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors" />
            <span>Assignee</span>
          </>
        ) : (
          <div className="flex items-center gap-1.5">
            <div className="flex items-center -space-x-1.5">
              {assignees.slice(0, 2).map((a) => (
                <UserAvatar
                  key={a.id}
                  size="xs"
                  name={a.name}
                  email={a.email}
                  image={a.image}
                  color={a.avatarColor}
                  userId={a.id}
                />
              ))}
            </div>
            <span className="truncate max-w-[110px]">
              {assignees.length === 1
                ? assignees[0].name || assignees[0].email.split("@")[0]
                : `${assignees.length} assignees`}
            </span>
          </div>
        )}
        <ChevronDown
          className={`w-3 h-3 text-slate-400 dark:text-slate-500 ml-0.5 transition-transform duration-150 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-64 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-xl border border-slate-200/80 dark:border-slate-800 p-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="px-2 py-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase flex items-center justify-between">
            <span>Workspace Members</span>
            {isTogglingId && (
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 text-[10px] normal-case font-normal">
                <Loader2 className="w-2.5 h-2.5 animate-spin" />
                Saving...
              </span>
            )}
          </div>

          {/* Search bar */}
          {members.length > 4 && (
            <div className="relative my-1.5 px-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search member..."
                className="w-full pl-7 pr-2 py-1 text-xs rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-amber-500"
                autoFocus
              />
            </div>
          )}

          {/* Member List */}
          <div className="space-y-0.5 max-h-56 overflow-y-auto custom-scrollbar pt-1">
            {isLoadingMembers ? (
              <div className="flex items-center justify-center py-4 text-xs text-slate-400 gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
                Loading members...
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="py-3 text-center text-xs text-slate-400">
                {searchQuery ? "No members found" : "No members available"}
              </div>
            ) : (
              filteredMembers.map((member) => {
                const isAssigned = assignedUserIds.has(member.userId);
                const isToggling = isTogglingId === member.userId;

                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => handleToggleMember(member)}
                    disabled={isToggling}
                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded-xl text-xs transition-colors cursor-pointer text-left ${
                      isAssigned
                        ? "bg-amber-50/80 dark:bg-amber-950/40 text-slate-900 dark:text-slate-100 font-medium"
                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                      {/* Avatar */}
                      <UserAvatar
                        size="sm"
                        name={member.name}
                        email={member.email}
                        image={member.image}
                        color={member.avatarColor}
                        userId={member.userId}
                        borderColor="border-white dark:border-slate-800"
                      />

                      {/* Name & Email */}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs leading-tight">
                          {member.name || member.email.split("@")[0]}
                          {member.isCurrentUser && (
                            <span className="ml-1 text-[10px] text-slate-400 dark:text-slate-500 font-normal">
                              (You)
                            </span>
                          )}
                        </div>
                        <div className="truncate text-[10px] text-slate-400 dark:text-slate-500 leading-tight">
                          {member.email}
                        </div>
                      </div>
                    </div>

                    {/* Checkbox indicator */}
                    <div className="shrink-0 flex items-center">
                      {isToggling ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
                      ) : isAssigned ? (
                        <div className="w-4 h-4 rounded-md bg-amber-500 text-white flex items-center justify-center">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      ) : (
                        <div className="w-4 h-4 rounded-md border border-slate-300 dark:border-slate-600 hover:border-amber-400" />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
