"use client";

import { useState } from "react";
import { TaskWithTag } from "@/db/schema";
import { TaskCard } from "./TaskCard";
import { DropTargetState } from "./hooks/useBoardDnD";
import { ChevronDown, ChevronUp } from "lucide-react";

const DEFAULT_MAX_VISIBLE = 2;

interface TaskSubtasksListProps {
  subtasks: TaskWithTag[];
  scheduledDate?: string | null;
  draggedTaskId: string | null;
  draggedTask: TaskWithTag | null;
  dropTarget: DropTargetState | null;
  onDragStart: (e: React.DragEvent, task: TaskWithTag) => void;
  onDragEnd: () => void;
  onCardDragOver: (
    e: React.DragEvent,
    targetTask: TaskWithTag,
    dateStr?: string | null
  ) => void;
  onDrop: (
    e: React.DragEvent,
    dateStr?: string | null,
    onTargetTask?: TaskWithTag
  ) => void;
  onOpenTask: (taskOrId: TaskWithTag | string) => void;
  onToggleCompleted: (e: React.MouseEvent, task: TaskWithTag) => void;
  isCollapsed?: boolean;
}

export function TaskSubtasksList({
  subtasks,
  scheduledDate,
  draggedTaskId,
  draggedTask,
  dropTarget,
  onDragStart,
  onDragEnd,
  onCardDragOver,
  onDrop,
  onOpenTask,
  onToggleCompleted,
  isCollapsed = false,
}: TaskSubtasksListProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!subtasks || subtasks.length === 0 || isCollapsed) {
    return null;
  }

  // Keep all visible if an item in the list is currently dragged or targeted by DnD
  const hasActiveDnDItem = Boolean(
    (draggedTaskId && subtasks.some((s) => s.id === draggedTaskId)) ||
      (dropTarget?.targetTaskId &&
        subtasks.some((s) => s.id === dropTarget.targetTaskId))
  );

  const shouldShowAll = isExpanded || hasActiveDnDItem || subtasks.length <= DEFAULT_MAX_VISIBLE;
  const visibleSubtasks = shouldShowAll
    ? subtasks
    : subtasks.slice(0, DEFAULT_MAX_VISIBLE);
  const hiddenCount = subtasks.length - visibleSubtasks.length;

  return (
    <div className="ml-4 space-y-1.5 my-1">
      {visibleSubtasks.map((sub) => (
        <TaskCard
          key={sub.id}
          task={sub}
          isSameDaySubtask={true}
          scheduledDate={scheduledDate !== undefined ? scheduledDate : sub.date}
          draggedTaskId={draggedTaskId}
          draggedTask={draggedTask}
          dropTarget={dropTarget}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onCardDragOver={onCardDragOver}
          onDrop={onDrop}
          onOpenTask={onOpenTask}
          onToggleCompleted={onToggleCompleted}
        />
      ))}

      {/* Truncation & Progressive Disclosure Controls */}
      {subtasks.length > DEFAULT_MAX_VISIBLE && !hasActiveDnDItem && (
        <div className="pt-0.5">
          {isExpanded ? (
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-amber-600 dark:text-slate-400 dark:hover:text-amber-400 bg-white/80 hover:bg-white dark:bg-slate-900/80 dark:hover:bg-slate-900 border border-slate-200/70 dark:border-slate-800 rounded-lg px-2 py-0.5 transition-all cursor-pointer shadow-2xs"
            >
              <ChevronUp className="w-3 h-3 text-amber-500" />
              <span>Show less</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsExpanded(true)}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:text-amber-600 dark:text-slate-300 dark:hover:text-amber-400 bg-white/80 hover:bg-white dark:bg-slate-900/80 dark:hover:bg-slate-900 border border-slate-200/70 dark:border-slate-800 rounded-lg px-2 py-0.5 transition-all cursor-pointer shadow-2xs"
            >
              <ChevronDown className="w-3 h-3 text-amber-500" />
              <span>
                +{hiddenCount} more {hiddenCount === 1 ? "subtask" : "subtasks"}
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
