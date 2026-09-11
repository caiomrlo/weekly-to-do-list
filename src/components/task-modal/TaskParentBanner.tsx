"use client";

import { TaskWithTag } from "@/db/schema";
import { CornerDownRight, ArrowRight } from "lucide-react";

interface TaskParentBannerProps {
  parentId: string;
  parentTitle?: string | null;
  onOpenTask?: (task: TaskWithTag | string) => void;
}

export function TaskParentBanner({
  parentId,
  parentTitle,
  onOpenTask,
}: TaskParentBannerProps) {
  return (
    <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 bg-amber-50/80 dark:bg-amber-950/60 border border-amber-100/90 dark:border-amber-900/60 rounded-2xl text-xs">
      <div className="flex items-center gap-2 min-w-0">
        <CornerDownRight className="w-4 h-4 text-amber-500 flex-shrink-0" />
        <span className="text-slate-500 dark:text-slate-400 font-medium flex-shrink-0">
          Subtask of:
        </span>
        <span className="font-semibold text-amber-800 dark:text-amber-300 truncate">
          {parentTitle || "Parent Task"}
        </span>
      </div>
      {onOpenTask && (
        <button
          type="button"
          onClick={() => onOpenTask(parentId)}
          className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 hover:underline flex-shrink-0 cursor-pointer text-xs"
        >
          <span>View parent task</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
