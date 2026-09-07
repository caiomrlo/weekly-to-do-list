"use client";

import { TaskWithTag } from "@/db/schema";
import { getProjectColorStyles } from "@/lib/project-utils";
import { formatDuration, formatDayShort } from "@/lib/date-utils";
import { DropTargetState } from "./hooks/useBoardDnD";
import {
  GripVertical,
  CheckCircle2,
  Circle,
  CornerDownRight,
  CalendarDays,
  ListTree,
  Clock,
  Timer,
  Paperclip,
} from "lucide-react";

interface TaskCardProps {
  task: TaskWithTag;
  isSameDaySubtask?: boolean;
  isDiffDaySubtask?: boolean;
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
}

export function TaskCard({
  task,
  isSameDaySubtask = false,
  isDiffDaySubtask = false,
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
}: TaskCardProps) {
  const projectStyles = task.project ? getProjectColorStyles(task.project.color) : null;
  const isDragging = draggedTaskId === task.id;
  const isTarget = dropTarget?.targetTaskId === task.id;
  const isNestTarget = isTarget && dropTarget?.position === "nest";
  const isBeforeTarget = isTarget && dropTarget?.position === "before";
  const isAfterTarget = isTarget && dropTarget?.position === "after";

  // Se o pai desta subtarefa estiver sendo arrastado, destaca que a subtarefa o acompanha
  const isAttachedToDragged = Boolean(
    draggedTaskId &&
      task.parentId === draggedTaskId &&
      draggedTask &&
      task.date === draggedTask.date
  );

  const cardDateStr = task.date || "unscheduled";

  return (
    <div
      draggable={true}
      onDragStart={(e) => onDragStart(e, task)}
      onDragEnd={onDragEnd}
      onDragOver={(e) => onCardDragOver(e, task, cardDateStr)}
      onDrop={(e) => onDrop(e, cardDateStr, task)}
      onClick={() => onOpenTask(task)}
      className={`group relative flex items-start gap-2 p-2.5 rounded-xl border transition-all select-none cursor-pointer ${
        isDragging
          ? "opacity-35 scale-[0.98] border-dashed border-indigo-400 dark:border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/30 shadow-none cursor-grabbing"
          : isNestTarget
            ? "ring-2 ring-indigo-500 bg-indigo-50/85 dark:bg-indigo-950/85 border-indigo-400 dark:border-indigo-500 shadow-md cursor-grabbing"
            : isAttachedToDragged
              ? "opacity-60 border-dashed border-indigo-300 dark:border-indigo-600 bg-indigo-50/10 dark:bg-indigo-950/20"
              : task.completed
                ? "bg-slate-50/50 dark:bg-slate-900/40 border-slate-200/40 dark:border-slate-800/40 text-slate-400 dark:text-slate-500"
                : isSameDaySubtask
                  ? "bg-white/95 hover:bg-white dark:bg-slate-900/80 dark:hover:bg-slate-900 border-slate-200/70 dark:border-slate-800 text-slate-800 dark:text-slate-100 hover:shadow-xs hover:border-indigo-300 dark:hover:border-indigo-500/50"
                  : "bg-white/85 hover:bg-white dark:bg-slate-900/70 dark:hover:bg-slate-900 border-slate-200/60 dark:border-slate-800 text-slate-800 dark:text-slate-100 hover:shadow-xs hover:border-indigo-200 dark:hover:border-indigo-500/40"
      }`}
    >
      {/* Drop Indicator Line: Before */}
      {isBeforeTarget && (
        <div className="absolute -top-1.5 left-0 right-0 h-0.5 bg-indigo-600 rounded-full z-30 pointer-events-none flex items-center">
          <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 -ml-1 ring-2 ring-white dark:ring-slate-900 shadow-xs" />
        </div>
      )}

      {/* Drop Indicator Line: After */}
      {isAfterTarget && (
        <div className="absolute -bottom-1.5 left-0 right-0 h-0.5 bg-indigo-600 rounded-full z-30 pointer-events-none flex items-center">
          <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 -ml-1 ring-2 ring-white dark:ring-slate-900 shadow-xs" />
        </div>
      )}

      {/* Drag Grip Handle */}
      <div
        className="mt-0.5 text-slate-300 group-hover:text-slate-500 dark:text-slate-600 dark:group-hover:text-slate-400 transition-colors flex-shrink-0 cursor-grab active:cursor-grabbing"
        title="Arraste para mover ou reordenar"
      >
        <GripVertical className="w-3.5 h-3.5" />
      </div>

      {/* Checkbox */}
      <button
        type="button"
        draggable={false}
        onClick={(e) => onToggleCompleted(e, task)}
        className="mt-0.5 text-slate-400 hover:text-indigo-600 dark:text-slate-500 dark:hover:text-indigo-400 transition-colors cursor-pointer flex-shrink-0"
      >
        {task.completed ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
        ) : (
          <Circle className="w-4 h-4 text-slate-300 hover:text-indigo-500 dark:text-slate-600 dark:hover:text-indigo-400" />
        )}
      </button>

      {/* Title and details */}
      <div className={`flex-1 min-w-0 ${draggedTaskId ? "pointer-events-none" : ""}`}>
        {/* Diff day indicator (parent pill) */}
        {isDiffDaySubtask && task.parent && (
          <div className="flex items-center gap-1 mb-1">
            <span
              className="inline-flex items-center gap-1 text-[10px] font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50/90 dark:bg-indigo-950/70 border border-indigo-100 dark:border-indigo-900/60 px-1.5 py-0.5 rounded-md max-w-[170px] truncate"
              title={`Subtarefa de: ${task.parent.title}`}
            >
              <CornerDownRight className="w-2.5 h-2.5 text-indigo-500 flex-shrink-0" />
              <span className="truncate">{task.parent.title}</span>
            </span>
          </div>
        )}

        <p
          className={`text-xs font-medium leading-snug break-words ${
            task.completed
              ? "line-through text-slate-400 dark:text-slate-500"
              : "text-slate-700 dark:text-slate-200"
          }`}
        >
          {task.title}
        </p>

        {/* Nest Target Indicator Pill */}
        {isNestTarget && (
          <div className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-100/90 dark:bg-indigo-950/90 px-1.5 py-0.5 rounded-md animate-pulse">
            <CornerDownRight className="w-2.5 h-2.5 text-indigo-600 flex-shrink-0" />
            <span>Soltar para virar subtarefa</span>
          </div>
        )}

        {/* Tag, Time, Duration, Scheduled Date & Subtask Progress Badges row */}
        {Boolean(
          task.tag ||
            task.time ||
            scheduledDate ||
            (task.duration != null && task.duration > 0) ||
            (task.subtaskCount != null && task.subtaskCount > 0)
        ) && (
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            {/* Scheduled Date Badge (when displayed in unscheduled card) */}
            {scheduledDate && (
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold border shadow-2xs ${
                  task.completed
                    ? "bg-slate-100/80 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500 border-slate-200/50 dark:border-slate-700/50"
                    : "bg-amber-50/90 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200/60 dark:border-amber-800/60"
                }`}
                title={`Agendada para ${formatDayShort(scheduledDate)}`}
              >
                <CalendarDays className="w-2.5 h-2.5 text-amber-500" />
                <span>{formatDayShort(scheduledDate)}</span>
              </span>
            )}

            {/* Subtask progress count badge for main tasks */}
            {Boolean(task.subtaskCount != null && task.subtaskCount > 0) && (
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium border shadow-2xs ${
                  task.completed ||
                  task.completedSubtaskCount === task.subtaskCount
                    ? "bg-slate-100/80 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500 border-slate-200/50 dark:border-slate-700/50"
                    : "bg-indigo-50/90 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200/60 dark:border-indigo-800/60"
                }`}
                title={`Subtarefas: ${task.completedSubtaskCount || 0} de ${
                  task.subtaskCount
                } concluídas`}
              >
                <ListTree
                  className={`w-2.5 h-2.5 ${
                    task.completed
                      ? "text-slate-400 dark:text-slate-500"
                      : "text-indigo-500"
                  }`}
                />
                <span>
                  {task.completedSubtaskCount || 0}/{task.subtaskCount}
                </span>
              </span>
            )}

            {/* Attachment count badge */}
            {Boolean(task.attachmentCount != null && task.attachmentCount > 0) && (
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium border shadow-2xs ${
                  task.completed
                    ? "bg-slate-100/80 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500 border-slate-200/50 dark:border-slate-700/50"
                    : "bg-slate-50/90 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-slate-200/60 dark:border-slate-700/60"
                }`}
                title={`Anexos: ${task.attachmentCount}`}
              >
                <Paperclip
                  className={`w-2.5 h-2.5 ${
                    task.completed
                      ? "text-slate-400 dark:text-slate-500"
                      : "text-slate-500 dark:text-slate-400"
                  }`}
                />
                <span>{task.attachmentCount}</span>
              </span>
            )}

            {/* Project badge */}
            {task.project && projectStyles && (
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium border shadow-2xs ${
                  task.completed
                    ? "bg-slate-100/80 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500 border-slate-200/50 dark:border-slate-700/50"
                    : projectStyles.badgeClass
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    task.completed ? "bg-slate-400" : projectStyles.dotClass
                  }`}
                />
                <span className="truncate max-w-[110px]">{task.project.name}</span>
              </span>
            )}

            {/* Time badge */}
            {task.time && (
              <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                <Clock className="w-2.5 h-2.5 text-indigo-400" />
                {task.time}
              </span>
            )}

            {/* Duration badge */}
            {Boolean(task.duration != null && task.duration > 0) && (
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md border shadow-2xs ${
                  task.completed
                    ? "bg-slate-100/80 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500 border-slate-200/50 dark:border-slate-700/50"
                    : "bg-amber-50/90 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200/60 dark:border-amber-800/60"
                }`}
                title={`Duração estimada: ${formatDuration(task.duration!)}`}
              >
                <Timer
                  className={`w-2.5 h-2.5 ${
                    task.completed
                      ? "text-slate-400 dark:text-slate-500"
                      : "text-amber-500"
                  }`}
                />
                {formatDuration(task.duration!)}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
