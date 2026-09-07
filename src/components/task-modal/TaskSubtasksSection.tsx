"use client";

import { useState } from "react";
import { TaskWithTag } from "@/db/schema";
import {
  ListTree,
  Loader2,
  CheckCircle2,
  Circle,
  ExternalLink,
  Trash2,
  Plus,
} from "lucide-react";

interface TaskSubtasksSectionProps {
  subtasks: TaskWithTag[];
  isLoading: boolean;
  parentDate: string;
  onToggleSubtask: (sub: TaskWithTag) => void;
  onDeleteSubtask: (subId: string) => void;
  onCreateSubtask: (title: string) => Promise<void>;
  onOpenTask?: (task: TaskWithTag | string) => void;
}

export function TaskSubtasksSection({
  subtasks,
  isLoading,
  parentDate,
  onToggleSubtask,
  onDeleteSubtask,
  onCreateSubtask,
  onOpenTask,
}: TaskSubtasksSectionProps) {
  const [newTitle, setNewTitle] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTitle.trim();
    if (!trimmed || isAdding) return;

    setIsAdding(true);
    try {
      await onCreateSubtask(trimmed);
      setNewTitle("");
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="space-y-3 p-4 bg-slate-50/70 dark:bg-slate-900/50 rounded-2xl border border-slate-200/60 dark:border-slate-800">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <ListTree className="w-3.5 h-3.5 text-indigo-500" />
          Subtasks
          {subtasks.length > 0 && (
            <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-200/60 dark:border-indigo-800/60 shadow-2xs">
              {subtasks.filter((s) => s.completed).length} of {subtasks.length} completed
            </span>
          )}
        </label>
      </div>

      {/* Subtasks List */}
      <div className="space-y-1.5">
        {isLoading && subtasks.length === 0 ? (
          <div className="flex items-center gap-2 py-2 text-xs text-slate-400 dark:text-slate-500">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Loading subtasks...</span>
          </div>
        ) : null}

        {subtasks.map((sub) => {
          const isDiffDate = (sub.date || null) !== (parentDate || null);
          return (
            <div
              key={sub.id}
              className={`group flex items-center justify-between gap-2.5 p-2 rounded-xl border transition-all text-xs ${
                sub.completed
                  ? "bg-slate-100/60 dark:bg-slate-900/40 border-slate-200/40 dark:border-slate-800/40 text-slate-400 dark:text-slate-500"
                  : "bg-white/90 hover:bg-white dark:bg-slate-900/80 dark:hover:bg-slate-900 border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-200 shadow-2xs"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => onToggleSubtask(sub)}
                  className="text-slate-400 hover:text-indigo-600 dark:text-slate-500 dark:hover:text-indigo-400 transition-colors cursor-pointer flex-shrink-0"
                  title={sub.completed ? "Mark as pending" : "Mark as completed"}
                >
                  {sub.completed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Circle className="w-4 h-4 text-slate-300 dark:text-slate-600 hover:text-indigo-500 dark:hover:text-indigo-400" />
                  )}
                </button>

                <span
                  className={`truncate flex-1 font-medium ${
                    sub.completed
                      ? "line-through text-slate-400 dark:text-slate-500"
                      : "text-slate-700 dark:text-slate-200"
                  }`}
                >
                  {sub.title}
                </span>

                {/* Tag pill */}
                {sub.tag && (
                  <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md flex-shrink-0">
                    {sub.tag.name}
                  </span>
                )}

                {/* Date pill */}
                {isDiffDate && sub.date && (
                  <span
                    className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-200/60 dark:border-amber-800/60 px-1.5 py-0.5 rounded-md flex-shrink-0"
                    title={`Scheduled for ${sub.date}`}
                  >
                    {sub.date.split("-").reverse().slice(0, 2).join("/")}
                  </span>
                )}
                {isDiffDate && !sub.date && (
                  <span
                    className="text-[10px] font-medium text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md flex-shrink-0"
                    title="No date set"
                  >
                    No date
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                {onOpenTask && (
                  <button
                    type="button"
                    onClick={() => onOpenTask(sub)}
                    className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors cursor-pointer"
                    title="Open full subtask details"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onDeleteSubtask(sub.id)}
                  className="p-1 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                  title="Delete subtask"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}

        {/* Quick Add Subtask Input */}
        <form onSubmit={handleSubmit} className="pt-1">
          <div className="relative">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="+ Add subtask... (Enter to save)"
              disabled={isAdding}
              className="w-full text-xs bg-white/80 hover:bg-white focus:bg-white dark:bg-slate-900/60 dark:hover:bg-slate-900/80 dark:focus:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl pl-3 pr-8 py-2 text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-indigo-500/30 focus:border-indigo-400 dark:focus:border-indigo-500 transition-all shadow-2xs"
            />
            {newTitle.trim() && (
              <button
                type="submit"
                disabled={isAdding}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 p-0.5 cursor-pointer"
                title="Add subtask"
              >
                {isAdding ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
