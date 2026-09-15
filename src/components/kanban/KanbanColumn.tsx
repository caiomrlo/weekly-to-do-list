"use client";

import React, { useState, useRef } from "react";
import { TaskStatus, TaskWithTag } from "@/db/schema";
import { getStatusStyles } from "@/lib/status-utils";
import { KanbanCard } from "./KanbanCard";
import { Plus, MoreHorizontal, X, Loader2 } from "lucide-react";

export interface KanbanColumnProps {
  status: TaskStatus;
  tasks: TaskWithTag[];
  draggedTaskId: string | null;
  dragOverCardId: string | null;
  isDragOverColumn: boolean;
  onEditStatus: (status: TaskStatus) => void;
  onQuickAddTask: (title: string, statusId: string) => Promise<void>;
  onTaskClick: (task: TaskWithTag) => void;
  onToggleCompleted: (e: React.MouseEvent, task: TaskWithTag) => void;
  onDragStart: (e: React.DragEvent, task: TaskWithTag) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onDragOverCard: (e: React.DragEvent, taskId: string) => void;
  onDropOnCard: (e: React.DragEvent, targetTaskId: string, statusId: string) => void;
  onDragOverColumn: (e: React.DragEvent, statusId: string) => void;
  onDropOnColumn: (e: React.DragEvent, statusId: string) => void;
}

export function KanbanColumn({
  status,
  tasks,
  draggedTaskId,
  dragOverCardId,
  isDragOverColumn,
  onEditStatus,
  onQuickAddTask,
  onTaskClick,
  onToggleCompleted,
  onDragStart,
  onDragEnd,
  onDragOverCard,
  onDropOnCard,
  onDragOverColumn,
  onDropOnColumn,
}: KanbanColumnProps) {
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [quickTitle, setQuickTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const styles = getStatusStyles(status.color);

  const handleQuickSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = quickTitle.trim();
    if (!trimmed) {
      setIsAddingTask(false);
      return;
    }

    setIsSubmitting(true);
    try {
      await onQuickAddTask(trimmed, status.id);
      setQuickTitle("");
      inputRef.current?.focus();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsAddingTask(false);
      setQuickTitle("");
    }
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        onDragOverColumn(e, status.id);
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDropOnColumn(e, status.id);
      }}
      className={`w-72 sm:w-80 flex-shrink-0 flex flex-col rounded-3xl p-3 border transition-all glass-panel ${
        isDragOverColumn
          ? "ring-2 ring-amber-500/50 border-amber-400/80 bg-amber-50/30 dark:bg-amber-950/30"
          : "border-white/60 dark:border-slate-800/80"
      }`}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between px-2 py-1.5 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${styles.dotClass}`} />
          <h2 className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 tracking-tight truncate">
            {status.name}
          </h2>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-200/70 dark:bg-slate-700/70 text-slate-600 dark:text-slate-300">
            {tasks.length}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => {
              setIsAddingTask(true);
              setTimeout(() => inputRef.current?.focus(), 50);
            }}
            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
            title="Add task to column"
          >
            <Plus className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => onEditStatus(status)}
            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
            title="Configure column"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Quick Task Input Form */}
      {isAddingTask && (
        <form onSubmit={handleQuickSubmit} className="mb-3 px-1">
          <div className="rounded-2xl p-2 bg-white dark:bg-slate-900 border border-amber-400 dark:border-amber-500 shadow-sm space-y-2 animate-in fade-in duration-100">
            <input
              ref={inputRef}
              type="text"
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Task title..."
              className="w-full text-xs bg-transparent text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none"
            />
            <div className="flex items-center justify-end gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  setIsAddingTask(false);
                  setQuickTitle("");
                }}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !quickTitle.trim()}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white transition-all disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <span>Add</span>
                )}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Tasks List */}
      <div className="flex-1 space-y-2 overflow-y-auto max-h-[calc(100vh-220px)] p-0.5 custom-scrollbar">
        {tasks.map((task) => (
          <KanbanCard
            key={task.id}
            task={task}
            isDragging={draggedTaskId === task.id}
            isDropTarget={dragOverCardId === task.id}
            onTaskClick={onTaskClick}
            onToggleCompleted={onToggleCompleted}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragOver={onDragOverCard}
            onDrop={(e, targetTaskId) => onDropOnCard(e, targetTaskId, status.id)}
          />
        ))}

        {tasks.length === 0 && !isAddingTask && (
          <div className="h-28 flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center p-3 text-slate-400 dark:text-slate-500 text-xs">
            <span>No tasks in this column</span>
            <button
              type="button"
              onClick={() => {
                setIsAddingTask(true);
                setTimeout(() => inputRef.current?.focus(), 50);
              }}
              className="mt-1.5 text-amber-600 dark:text-amber-400 hover:underline font-medium cursor-pointer inline-flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              <span>Create task</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}