"use client";

import { TaskWithTag } from "@/db/schema";
import { useBoardDnD } from "./hooks/useBoardDnD";
import { TaskCard } from "./TaskCard";
import { Plus } from "lucide-react";

export interface DayInfo {
  dateStr: string;
  dayNameShort: string;
  dayNumber: number;
  monthNameShort: string;
  isToday: boolean;
  dayOfWeek: number;
}

interface DayColumnProps {
  day: DayInfo;
  tasks: TaskWithTag[];
  dnd: ReturnType<typeof useBoardDnD>;
  quickAddTitle: string;
  onQuickAddChange: (val: string) => void;
  onQuickAddSubmit: () => void;
  onOpenTask: (taskOrId: TaskWithTag | string) => void;
  onToggleCompleted: (e: React.MouseEvent, task: TaskWithTag) => void;
}

export function DayColumn({
  day,
  tasks,
  dnd,
  quickAddTitle,
  onQuickAddChange,
  onQuickAddSubmit,
  onOpenTask,
  onToggleCompleted,
}: DayColumnProps) {
  const {
    draggedTaskId,
    draggedTask,
    dropTarget,
    handleDragStart,
    handleDragEnd,
    handleCardDragOver,
    handleColumnDragOver,
    handleColumnDragLeave,
    handleDrop,
  } = dnd;
  const completedCount = tasks.filter((t) => t.completed).length;

  const mainTasks = tasks.filter((t) => !t.parentId);
  const diffDaySubtasks = tasks.filter(
    (t) => t.parentId && !tasks.some((p) => p.id === t.parentId)
  );

  const isColumnDropTarget =
    dropTarget?.dateStr === day.dateStr &&
    (dropTarget.position === "column" || !dropTarget.targetTaskId);

  return (
    <div
      onDragOver={(e) => handleColumnDragOver(e, day.dateStr)}
      onDragLeave={(e) => handleColumnDragLeave(e, day.dateStr)}
      onDrop={(e) => handleDrop(e, day.dateStr)}
      className={`rounded-2xl flex flex-col min-h-[420px] p-3.5 transition-all duration-200 ${
        isColumnDropTarget
          ? "ring-2 ring-amber-400/50 bg-amber-50/25 dark:bg-amber-950/30"
          : day.isToday
            ? "glass-card-today ring-1 ring-amber-500/20"
            : "glass-card"
      }`}
    >
      {/* Column Day Header */}
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-200/40 dark:border-slate-800/60">
        <div className="flex items-center gap-2">
          <span
            className={`text-sm font-bold ${
              day.isToday
                ? "text-amber-600 dark:text-amber-400"
                : "text-slate-800 dark:text-slate-200"
            }`}
          >
            {day.dayNameShort}
          </span>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {day.dayNumber} {day.monthNameShort}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {tasks.length > 0 && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
              {completedCount}/{tasks.length}
            </span>
          )}
        </div>
      </div>

      {/* Tasks List for the Day */}
      <div className="flex-1 space-y-2 overflow-y-auto max-h-[560px] pr-0.5">
        {mainTasks.map((mainTask) => {
          const sameDaySubtasks = tasks.filter(
            (sub) => sub.parentId === mainTask.id
          );

          return (
            <div key={mainTask.id} className="space-y-1.5">
              <TaskCard
                task={mainTask}
                draggedTaskId={draggedTaskId}
                draggedTask={draggedTask}
                dropTarget={dropTarget}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onCardDragOver={handleCardDragOver}
                onDrop={handleDrop}
                onOpenTask={onOpenTask}
                onToggleCompleted={onToggleCompleted}
              />

              {/* Same day subtasks nested with left indent and connector guide line */}
              {sameDaySubtasks.length > 0 && (
                <div className="ml-5 pl-2.5 border-l-2 border-amber-200/60 dark:border-amber-800/60 space-y-1.5 my-1">
                  {sameDaySubtasks.map((sub) => (
                    <TaskCard
                      key={sub.id}
                      task={sub}
                      isSameDaySubtask={true}
                      draggedTaskId={draggedTaskId}
                      draggedTask={draggedTask}
                      dropTarget={dropTarget}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      onCardDragOver={handleCardDragOver}
                      onDrop={handleDrop}
                      onOpenTask={onOpenTask}
                      onToggleCompleted={onToggleCompleted}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Subtasks scheduled on this day whose parent is on a different day */}
        {diffDaySubtasks.map((sub) => (
          <div key={sub.id}>
            <TaskCard
              task={sub}
              isDiffDaySubtask={true}
              draggedTaskId={draggedTaskId}
              draggedTask={draggedTask}
              dropTarget={dropTarget}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onCardDragOver={handleCardDragOver}
              onDrop={handleDrop}
              onOpenTask={onOpenTask}
              onToggleCompleted={onToggleCompleted}
            />
          </div>
        ))}

        {/* Drag drop zone displayed on column during drag */}
        {draggedTaskId && (
          <div
            onDragOver={(e) => handleColumnDragOver(e, day.dateStr)}
            onDrop={(e) => handleDrop(e, day.dateStr)}
            className={`h-10 border-2 border-dashed rounded-xl flex items-center justify-center text-[11px] font-medium transition-all ${
              isColumnDropTarget
                ? "border-amber-400 dark:border-amber-500 bg-amber-50/70 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 shadow-xs"
                : "border-slate-200/60 dark:border-slate-700/60 text-slate-400 dark:text-slate-500 hover:border-amber-300 hover:text-amber-600 bg-white/20 dark:bg-slate-800/20"
            }`}
          >
            <span>Move to {day.dayNameShort}</span>
          </div>
        )}

        {/* Inline Quick Add Input */}
        <div className="pt-0.5">
          <div className="relative">
            <input
              type="text"
              value={quickAddTitle}
              onChange={(e) => onQuickAddChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onQuickAddSubmit();
                }
              }}
              placeholder="+ New task"
              className="w-full text-xs bg-white/70 hover:bg-white focus:bg-white dark:bg-slate-900/60 dark:hover:bg-slate-900/80 dark:focus:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-xl pl-3 pr-8 py-2 text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:focus:ring-amber-500/30 focus:border-amber-400 dark:focus:border-amber-500 transition-all shadow-2xs"
            />
            {Boolean(quickAddTitle.trim()) && (
              <button
                type="button"
                onClick={onQuickAddSubmit}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 p-0.5 cursor-pointer"
                title="Add"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
