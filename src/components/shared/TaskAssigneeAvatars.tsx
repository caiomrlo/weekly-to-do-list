"use client";

import { TaskAssigneeUser } from "@/db/schema";
import { UserAvatar } from "./UserAvatar";

// Retained for backward-compatibility if imported elsewhere
export const AVATAR_BG_COLORS = [
  "bg-amber-500 text-white",
  "bg-indigo-500 text-white",
  "bg-teal-500 text-white",
  "bg-rose-500 text-white",
  "bg-violet-500 text-white",
  "bg-sky-500 text-white",
];

export interface TaskAssigneeAvatarsProps {
  assignees?: TaskAssigneeUser[] | null;
  max?: number;
  size?: "xs" | "sm" | "md";
  className?: string;
}

export function TaskAssigneeAvatars({
  assignees,
  max = 3,
  size = "xs",
  className = "",
}: TaskAssigneeAvatarsProps) {
  if (!assignees || assignees.length === 0) {
    return null;
  }

  const displayed = assignees.slice(0, max);
  const overflow = Math.max(0, assignees.length - max);

  const sizeClasses = {
    xs: "w-4.5 h-4.5 text-[9px] border-[1.5px]",
    sm: "w-5.5 h-5.5 text-[10px] border-2",
    md: "w-7 h-7 text-xs border-2",
  }[size];

  const spacingClass = {
    xs: "-space-x-1.5",
    sm: "-space-x-2",
    md: "-space-x-2.5",
  }[size];

  return (
    <div
      className={`inline-flex items-center ${spacingClass} ${className}`}
      aria-label="Assigned members"
    >
      {displayed.map((assignee) => (
        <UserAvatar
          key={assignee.id}
          size={size}
          name={assignee.name}
          email={assignee.email}
          image={assignee.image}
          color={assignee.avatarColor}
          userId={assignee.id}
          className="hover:z-20"
        />
      ))}

      {overflow > 0 && (
        <div
          className={`relative rounded-full border-white dark:border-neutral-900 bg-slate-200 hover:bg-slate-300 dark:bg-neutral-700 dark:hover:bg-neutral-600 text-slate-700 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white font-bold shrink-0 flex items-center justify-center shadow-2xs select-none hover:z-20 transition-colors ${sizeClasses}`}
          title={`${overflow} more assignee${overflow > 1 ? "s" : ""}`}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}
