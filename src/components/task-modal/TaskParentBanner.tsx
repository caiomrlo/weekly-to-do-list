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
    <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 bg-indigo-50/80 dark:bg-indigo-950/60 border border-indigo-100/90 dark:border-indigo-900/60 rounded-2xl text-xs">
      <div className="flex items-center gap-2 min-w-0">
        <CornerDownRight className="w-4 h-4 text-indigo-500 flex-shrink-0" />
        <span className="text-slate-500 dark:text-slate-400 font-medium flex-shrink-0">
          Subtarefa de:
        </span>
        <span className="font-semibold text-indigo-700 dark:text-indigo-300 truncate">
          {parentTitle || "Tarefa Principal"}
        </span>
      </div>
      {onOpenTask && (
        <button
          type="button"
          onClick={() => onOpenTask(parentId)}
          className="inline-flex items-center gap-1 font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:underline flex-shrink-0 cursor-pointer text-xs"
        >
          <span>Ver tarefa principal</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
