"use client";

import React from "react";
import { TaskWithTag } from "@/db/schema";
import { getProjectColorStyles } from "@/lib/project-utils";
import { TAG_COLORS } from "@/lib/tag-utils";
import { toDateString } from "@/lib/date-utils";
import { TaskAssigneeAvatars } from "@/components/shared/TaskAssigneeAvatars";
import {
  GripVertical,
  CheckCircle2,
  Circle,
  Folder,
  Calendar,
  CheckSquare,
  Paperclip,
  FileText,
  Repeat,
} from "lucide-react";

export interface KanbanCardProps {
  task: TaskWithTag;
  todayStr?: string;
  isDragging?: boolean;
  isDropTarget?: boolean;
  onTaskClick: (task: TaskWithTag) => void;
  onToggleCompleted: (e: React.MouseEvent, task: TaskWithTag) => void;
  onDragStart: (e: React.DragEvent, task: TaskWithTag) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent, taskId: string) => void;
  onDrop: (e: React.DragEvent, taskId: string) => void;
}

export function KanbanCard({
  task,
  todayStr,
  isDragging,
  isDropTarget,
  onTaskClick,
  onToggleCompleted,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: KanbanCardProps) {
  const effectiveTodayStr = todayStr || toDateString(new Date());
  const taskDate = task.date || task.originalDate || null;
  const isToday = Boolean(taskDate && taskDate === effectiveTodayStr);

  const projectStyles = task.project
    ? getProjectColorStyles(task.project.color)
    : null;

  const tagStyles =
    task.tag && TAG_COLORS[task.tag.color]
      ? TAG_COLORS[task.tag.color]
      : null;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task)}
      onDragEnd={onDragEnd}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver(e, task.id);
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop(e, task.id);
      }}
      onClick={() => onTaskClick(task)}
      className={`group relative rounded-2xl p-3 border transition-all cursor-pointer select-none ${
        isDragging
          ? "opacity-40 scale-95 border-dashed border-amber-400 dark:border-amber-500 bg-amber-50/20 dark:bg-amber-950/20"
          : isDropTarget
            ? "border-amber-500 ring-2 ring-amber-500/30 bg-amber-50/40 dark:bg-amber-950/40"
            : task.completed
              ? isToday
                ? "bg-amber-50/15 hover:bg-amber-50/25 dark:bg-amber-950/15 dark:hover:bg-amber-950/25 border-amber-300/40 dark:border-amber-700/40 text-slate-400 dark:text-slate-500"
                : "bg-white/60 hover:bg-white/80 dark:bg-slate-900/40 dark:hover:bg-slate-900/60 border-slate-200/50 dark:border-slate-800/50 text-slate-400 dark:text-slate-500"
              : isToday
                ? "bg-amber-50/30 hover:bg-amber-50/50 dark:bg-amber-950/20 dark:hover:bg-amber-950/35 border-amber-300/80 dark:border-amber-600/50 text-slate-800 dark:text-slate-100 shadow-2xs hover:shadow-xs ring-1 ring-amber-400/25 dark:ring-amber-500/20 hover:border-amber-400 dark:hover:border-amber-500/70"
                : "bg-white/90 hover:bg-white dark:bg-slate-900/80 dark:hover:bg-slate-900 border-slate-200/70 dark:border-slate-800 text-slate-800 dark:text-slate-100 shadow-2xs hover:shadow-xs hover:border-amber-300 dark:hover:border-amber-500/40"
      }`}
    >
      <div className="flex items-start gap-2">
        {/* Grip Handle */}
        <div
          className="mt-0.5 text-slate-300 group-hover:text-slate-400 dark:text-slate-600 dark:group-hover:text-slate-400 transition-colors flex-shrink-0 cursor-grab active:cursor-grabbing"
          title="Drag to move or reorder"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </div>

        {/* Checkbox */}
        <button
          type="button"
          draggable={false}
          onClick={(e) => onToggleCompleted(e, task)}
          className="mt-0.5 text-slate-400 hover:text-amber-600 dark:text-slate-500 dark:hover:text-amber-400 transition-colors cursor-pointer flex-shrink-0"
          title={task.completed ? "Mark as pending" : "Mark as completed"}
        >
          {task.completed ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          ) : (
            <Circle className="w-4 h-4 text-slate-300 hover:text-amber-500 dark:text-slate-600 dark:hover:text-amber-400" />
          )}
        </button>

        {/* Card Content */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Title */}
          <div
            className={`text-xs sm:text-sm font-medium leading-snug break-words ${
              task.completed
                ? "line-through text-slate-400 dark:text-slate-500"
                : "text-slate-800 dark:text-slate-100"
            }`}
          >
            {task.title}
          </div>

          {/* Badges and Metadata */}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {/* Project Pill */}
            {task.project && projectStyles && (
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium border ${
                  task.completed ? "bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700" : projectStyles.badgeClass
                }`}
                title={`Project: ${task.project.name}`}
              >
                <Folder className="w-2.5 h-2.5 shrink-0" />
                <span className="truncate max-w-[90px]">{task.project.name}</span>
              </span>
            )}

            {/* Tag Pill */}
            {task.tag && tagStyles && (
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium border ${
                  task.completed ? "bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700" : tagStyles.badgeClass
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${tagStyles.dotClass}`} />
                <span className="truncate max-w-[80px]">{task.tag.name}</span>
              </span>
            )}

            {/* Date Badge */}
            {taskDate && (
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium border transition-colors ${
                  task.completed
                    ? isToday
                      ? "bg-amber-500/10 text-amber-600/70 dark:text-amber-400/60 border-amber-200/50 dark:border-amber-900/40"
                      : "bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700"
                    : isToday
                      ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300/80 dark:border-amber-600/50 font-semibold"
                      : "bg-slate-100/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60"
                }`}
                title={`Scheduled: ${taskDate}${isToday ? " (Today)" : ""}`}
              >
                <Calendar
                  className={`w-2.5 h-2.5 ${
                    isToday
                      ? task.completed
                        ? "text-amber-500/60 dark:text-amber-400/50"
                        : "text-amber-600 dark:text-amber-400"
                      : ""
                  }`}
                />
                <span>{isToday ? "Today" : taskDate}</span>
              </span>
            )}

            {/* Recurring Badge */}
            {task.recurringRuleId && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-amber-50/80 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60"
                title={
                  task.recurringRule?.frequency
                    ? `Recurring: ${task.recurringRule.frequency}`
                    : "Recurring task"
                }
              >
                <Repeat className="w-2.5 h-2.5 shrink-0" />
                {task.recurringRule?.frequency && (
                  <span className="capitalize">{task.recurringRule.frequency}</span>
                )}
              </span>
            )}

            {/* Subtasks Count */}
            {Boolean(task.subtaskCount && task.subtaskCount > 0) && (
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium border ${
                  task.completedSubtaskCount === task.subtaskCount
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60"
                    : "bg-slate-100/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border-slate-200/60 dark:border-slate-700/60"
                }`}
                title={`Subtasks: ${task.completedSubtaskCount || 0}/${task.subtaskCount}`}
              >
                <CheckSquare className="w-2.5 h-2.5" />
                <span>
                  {task.completedSubtaskCount || 0}/{task.subtaskCount}
                </span>
              </span>
            )}

            {/* Attachments Count */}
            {Boolean(task.attachmentCount && task.attachmentCount > 0) && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-slate-100/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60"
                title={`Attachments: ${task.attachmentCount}`}
              >
                <Paperclip className="w-2.5 h-2.5" />
                <span>{task.attachmentCount}</span>
              </span>
            )}

            {/* Docs Count */}
            {Boolean(task.docCount && task.docCount > 0) && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-slate-100/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60"
                title={`Linked Docs: ${task.docCount}`}
              >
                <FileText className="w-2.5 h-2.5" />
                <span>{task.docCount}</span>
              </span>
            )}

            {/* Assignees */}
            {Boolean(task.assignees && task.assignees.length > 0) && (
              <TaskAssigneeAvatars
                assignees={task.assignees}
                max={3}
                size="xs"
                className={task.completed ? "opacity-60 ml-auto" : "ml-auto"}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}