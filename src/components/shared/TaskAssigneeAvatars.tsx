"use client";

import { useState } from "react";
import { TaskAssigneeUser } from "@/db/schema";

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
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  if (!assignees || assignees.length === 0) {
    return null;
  }

  const handleImageError = (id: string) => {
    setImageErrors((prev) => ({ ...prev, [id]: true }));
  };

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
      {displayed.map((assignee, idx) => {
        const hasFailed = imageErrors[assignee.id];
        const showImage = Boolean(assignee.image && !hasFailed);
        const bgColor = AVATAR_BG_COLORS[idx % AVATAR_BG_COLORS.length];
        const initial = (
          assignee.name?.charAt(0) ||
          assignee.email?.charAt(0) ||
          "?"
        ).toUpperCase();
        const displayName = assignee.name || assignee.email;

        return (
          <div
            key={assignee.id}
            className={`relative rounded-full border-white dark:border-slate-900 overflow-hidden shrink-0 flex items-center justify-center font-semibold select-none shadow-2xs transition-transform hover:scale-110 hover:z-20 ${sizeClasses} ${
              !showImage ? bgColor : "bg-slate-100 dark:bg-slate-800"
            }`}
            title={displayName}
          >
            {showImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={assignee.image!}
                alt={displayName}
                onError={() => handleImageError(assignee.id)}
                className="w-full h-full object-cover"
              />
            ) : (
              <span>{initial}</span>
            )}
          </div>
        );
      })}

      {overflow > 0 && (
        <div
          className={`relative rounded-full border-white dark:border-slate-900 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold shrink-0 flex items-center justify-center shadow-2xs select-none hover:scale-110 hover:z-20 transition-transform ${sizeClasses}`}
          title={`${overflow} more assignee${overflow > 1 ? "s" : ""}`}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}
