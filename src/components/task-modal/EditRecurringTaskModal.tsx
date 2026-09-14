"use client";

import { Repeat } from "lucide-react";

interface EditRecurringTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (scope: "this" | "future") => void;
  isSaving?: boolean;
}

export function EditRecurringTaskModal({
  isOpen,
  onClose,
  onConfirm,
  isSaving = false,
}: EditRecurringTaskModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-2xs animate-in fade-in duration-150">
      <div className="w-full max-w-sm rounded-2xl glass-panel bg-white/95 dark:bg-slate-900/95 shadow-2xl border border-slate-200/80 dark:border-slate-800 p-5 space-y-4 text-slate-800 dark:text-slate-100 z-10">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-200/60 dark:border-slate-800/60">
          <div className="w-8 h-8 rounded-full bg-amber-500/10 dark:bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 flex-shrink-0">
            <Repeat className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Edit recurring task</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              How would you like to apply these changes?
            </p>
          </div>
        </div>

        <div className="space-y-2 pt-1">
          <button
            type="button"
            disabled={isSaving}
            onClick={() => onConfirm("this")}
            className="w-full text-left p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-amber-400 dark:hover:border-amber-500/60 bg-slate-50/60 hover:bg-amber-50/30 dark:bg-slate-800/50 dark:hover:bg-amber-950/20 transition-all cursor-pointer group"
          >
            <div className="font-semibold text-xs text-slate-800 dark:text-slate-200 group-hover:text-amber-700 dark:group-hover:text-amber-300">
              This occurrence only
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Only change this instance on this date
            </div>
          </button>

          <button
            type="button"
            disabled={isSaving}
            onClick={() => onConfirm("future")}
            className="w-full text-left p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-amber-400 dark:hover:border-amber-500/60 bg-slate-50/60 hover:bg-amber-50/30 dark:bg-slate-800/50 dark:hover:bg-amber-950/20 transition-all cursor-pointer group"
          >
            <div className="font-semibold text-xs text-slate-800 dark:text-slate-200 group-hover:text-amber-700 dark:group-hover:text-amber-300">
              This and future occurrences
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Apply changes to this and all future recurring instances
            </div>
          </button>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
          <button
            type="button"
            disabled={isSaving}
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
