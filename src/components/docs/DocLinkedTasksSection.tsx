"use client";

import { useState, useTransition } from "react";
import { unlinkDocFromTaskAction } from "@/app/actions/docs";
import { CheckCircle2, Circle, Calendar, Link2, X, Loader2 } from "lucide-react";

interface LinkedTask {
  id: string;
  title: string;
  completed: boolean;
  date?: string | null;
}

interface DocLinkedTasksSectionProps {
  docId: string;
  tasks: LinkedTask[];
  onTaskUnlinked: (taskId: string) => void;
}

export function DocLinkedTasksSection({
  docId,
  tasks,
  onTaskUnlinked,
}: DocLinkedTasksSectionProps) {
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (tasks.length === 0) {
    return null;
  }

  const handleUnlink = (taskId: string) => {
    setUnlinkingId(taskId);
    startTransition(async () => {
      try {
        const res = await unlinkDocFromTaskAction(taskId, docId);
        if (res.success) {
          onTaskUnlinked(taskId);
        }
      } catch (err) {
        console.error("Failed to unlink task:", err);
      } finally {
        setUnlinkingId(null);
      }
    });
  };

  return (
    <div className="rounded-2xl bg-slate-50/70 dark:bg-slate-900/50 border border-slate-200/70 dark:border-slate-800/80 p-3 sm:p-4 space-y-2.5">
      <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-1.5 uppercase tracking-wider">
          <Link2 className="w-3.5 h-3.5 text-indigo-500" />
          <span>Linked Tasks</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60">
            {tasks.length}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {tasks.map((task) => {
          const isUnlinkingThis = unlinkingId === task.id;

          return (
            <div
              key={task.id}
              className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200/70 dark:border-slate-700/70 text-xs shadow-2xs group hover:border-indigo-400/50 transition-all"
            >
              <div className="flex items-center gap-1.5">
                {task.completed ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                ) : (
                  <Circle className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 flex-shrink-0" />
                )}
                <span
                  className={`font-medium text-slate-700 dark:text-slate-200 max-w-[200px] truncate ${
                    task.completed ? "line-through text-slate-400 dark:text-slate-500" : ""
                  }`}
                  title={task.title}
                >
                  {task.title}
                </span>
              </div>

              {task.date && (
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
                  <Calendar className="w-3 h-3" />
                  {task.date}
                </span>
              )}

              <button
                type="button"
                onClick={() => handleUnlink(task.id)}
                disabled={isUnlinkingThis}
                className="text-slate-400 hover:text-rose-500 p-0.5 rounded-md transition-colors cursor-pointer disabled:opacity-50"
                title="Unlink from this document"
              >
                {isUnlinkingThis ? (
                  <Loader2 className="w-3 h-3 animate-spin text-rose-500" />
                ) : (
                  <X className="w-3 h-3" />
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
