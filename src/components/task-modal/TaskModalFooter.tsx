"use client";

import { useState } from "react";
import { Trash2, AlertTriangle } from "lucide-react";

interface TaskModalFooterProps {
  totalSubtasksToDelete: number;
  isRecurring?: boolean;
  isDeleting: boolean;
  onDelete: (scope?: "this" | "future" | "all") => void;
  onClose: () => void;
}

export function TaskModalFooter({
  totalSubtasksToDelete,
  isRecurring = false,
  isDeleting,
  onDelete,
  onClose,
}: TaskModalFooterProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  return (
    <div className="pt-4 mt-2 border-t border-slate-200/50 dark:border-slate-800/60 flex flex-wrap items-center justify-between gap-3">
      {!showDeleteConfirm ? (
        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-rose-500 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50/80 dark:hover:bg-rose-950/40 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
        >
          <Trash2 className="w-4 h-4" />
          Delete task
        </button>
      ) : isRecurring ? (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 bg-rose-50/90 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 p-2.5 rounded-xl text-xs">
          <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-300 font-medium">
            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0" />
            <span>Delete recurring:</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => onDelete("this")}
              className="px-2.5 py-1 bg-rose-600 text-white rounded-lg font-medium hover:bg-rose-700 transition-colors disabled:opacity-50 cursor-pointer text-xs"
              title="Delete only this occurrence"
            >
              This only
            </button>
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => onDelete("future")}
              className="px-2.5 py-1 bg-rose-600 text-white rounded-lg font-medium hover:bg-rose-700 transition-colors disabled:opacity-50 cursor-pointer text-xs"
              title="Delete this and future occurrences"
            >
              This & future
            </button>
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => onDelete("all")}
              className="px-2.5 py-1 bg-rose-700 text-white rounded-lg font-medium hover:bg-rose-800 transition-colors disabled:opacity-50 cursor-pointer text-xs"
              title="Delete all occurrences of this routine"
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(false)}
              className="px-2 py-1 text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 rounded-lg transition-colors cursor-pointer text-xs"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 bg-rose-50/90 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 p-2 rounded-xl text-xs sm:text-sm">
          <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0" />
          <span className="text-rose-700 dark:text-rose-300 font-medium">
            {totalSubtasksToDelete > 0
              ? `Delete task and its ${totalSubtasksToDelete} subtasks?`
              : "Delete task?"}
          </span>
          <button
            type="button"
            disabled={isDeleting}
            onClick={() => onDelete("this")}
            className="px-2.5 py-1 bg-rose-600 text-white rounded-lg font-medium hover:bg-rose-700 transition-colors disabled:opacity-50 cursor-pointer text-xs"
          >
            {isDeleting ? "Deleting..." : "Confirm"}
          </button>
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(false)}
            className="px-2 py-1 text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 rounded-lg transition-colors cursor-pointer text-xs"
          >
            Cancel
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={onClose}
        className="px-4 py-2 bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium text-xs sm:text-sm rounded-xl transition-colors cursor-pointer"
      >
        Done
      </button>
    </div>
  );
}
