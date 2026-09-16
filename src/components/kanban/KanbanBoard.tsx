"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  TaskWithTag,
  TaskStatus,
  UserPreferences,
  Workspace,
  BackgroundThemeId,
  DEFAULT_USER_PREFERENCES,
  TaskStatusCategory,
} from "@/db/schema";
import { useDarkMode } from "@/lib/hooks/useDarkMode";
import { updateUserPreferencesAction } from "@/app/actions/user";
import {
  createTaskAction,
  toggleTaskStatusAction,
  moveTaskKanbanAction,
} from "@/app/actions/tasks";
import {
  createTaskStatusAction,
  updateTaskStatusAction,
  deleteTaskStatusAction,
} from "@/app/actions/task-statuses";
import { AppHeader } from "../AppHeader";
import { TaskModal } from "../TaskModal";
import { KanbanColumn } from "./KanbanColumn";
import { StatusConfigModal } from "./StatusConfigModal";
import { Plus } from "lucide-react";

export interface KanbanBoardProps {
  initialTasks: TaskWithTag[];
  initialStatuses: TaskStatus[];
  userEmail: string;
  initialPreferences?: UserPreferences;
  workspaces?: Workspace[];
  activeWorkspaceId?: string;
}

export function KanbanBoard({
  initialTasks,
  initialStatuses,
  userEmail,
  initialPreferences,
  workspaces,
  activeWorkspaceId,
}: KanbanBoardProps) {
  const [preferences, setPreferences] = useState<UserPreferences>(
    initialPreferences || DEFAULT_USER_PREFERENCES
  );
  const [tasks, setTasks] = useState<TaskWithTag[]>(initialTasks);
  const [statuses, setStatuses] = useState<TaskStatus[]>(initialStatuses);

  // Task details modal state
  const [selectedTask, setSelectedTask] = useState<TaskWithTag | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  // Status configuration modal state
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [configModalMode, setConfigModalMode] = useState<"create" | "edit">("create");
  const [editingStatus, setEditingStatus] = useState<TaskStatus | null>(null);

  // Drag and drop state
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverCardId, setDragOverCardId] = useState<string | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);

  // Dark mode hook
  const isDarkMode = useDarkMode();

  const handleToggleTheme = async () => {
    const nextIsDark = !isDarkMode;

    if (nextIsDark) {
      document.documentElement.classList.add("dark");
      try {
        localStorage.setItem("theme", "dark");
        document.cookie = "theme=dark; path=/; max-age=31536000; SameSite=Lax";
      } catch {}
    } else {
      document.documentElement.classList.remove("dark");
      try {
        localStorage.setItem("theme", "light");
        document.cookie = "theme=light; path=/; max-age=31536000; SameSite=Lax";
      } catch {}
    }

    const nextTheme = nextIsDark ? "dark" : "light";
    setPreferences((prev) => ({ ...prev, theme: nextTheme }));

    try {
      await updateUserPreferencesAction({ theme: nextTheme });
    } catch (err) {
      console.error("Error saving theme preference:", err);
    }
  };

  const handleSelectBackground = async (bgId: BackgroundThemeId) => {
    setPreferences((prev) => ({ ...prev, background: bgId }));
    document.documentElement.setAttribute("data-theme-bg", bgId);
    try {
      localStorage.setItem("theme_bg", bgId);
    } catch {}

    try {
      await updateUserPreferencesAction({ background: bgId });
    } catch (err) {
      console.error("Error saving background preference:", err);
    }
  };

  useEffect(() => {
    const bg = (preferences.background as BackgroundThemeId) || "default";
    document.documentElement.setAttribute("data-theme-bg", bg);
    try {
      localStorage.setItem("theme_bg", bg);
    } catch {}
  }, [preferences.background]);

  // Sort statuses by order
  const sortedStatuses = useMemo(() => {
    return [...statuses].sort((a, b) => a.order - b.order);
  }, [statuses]);

  // Default status for fallback (isDefault true, or first todo, or first status)
  const defaultStatus = useMemo(() => {
    return (
      sortedStatuses.find((s) => s.isDefault) ||
      sortedStatuses.find((s) => s.category === "todo") ||
      sortedStatuses[0]
    );
  }, [sortedStatuses]);

  const defaultDoneStatus = useMemo(() => {
    return sortedStatuses.find((s) => s.category === "done");
  }, [sortedStatuses]);

  // Group tasks by status ID with fallback
  const tasksByStatus = useMemo(() => {
    const map = new Map<string, TaskWithTag[]>();
    for (const status of sortedStatuses) {
      map.set(status.id, []);
    }

    for (const task of tasks) {
      let targetStatusId = task.statusId;

      if (!targetStatusId || !map.has(targetStatusId)) {
        if (task.completed && defaultDoneStatus) {
          targetStatusId = defaultDoneStatus.id;
        } else if (defaultStatus) {
          targetStatusId = defaultStatus.id;
        }
      }

      if (targetStatusId && map.has(targetStatusId)) {
        map.get(targetStatusId)!.push(task);
      }
    }

    // Sort tasks in each status by order
    for (const list of map.values()) {
      list.sort((a, b) => a.order - b.order);
    }

    return map;
  }, [tasks, sortedStatuses, defaultStatus, defaultDoneStatus]);

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, task: TaskWithTag) => {
    setDraggedTaskId(task.id);
    e.dataTransfer.setData("text/plain", task.id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setDragOverCardId(null);
    setDragOverColumnId(null);
  };

  const handleDragOverColumn = (e: React.DragEvent, statusId: string) => {
    e.preventDefault();
    if (dragOverColumnId !== statusId) {
      setDragOverColumnId(statusId);
    }
  };

  const handleDragOverCard = (e: React.DragEvent, targetTaskId: string) => {
    e.preventDefault();
    if (dragOverCardId !== targetTaskId) {
      setDragOverCardId(targetTaskId);
    }
  };

  const executeMoveTask = async (
    taskId: string,
    targetStatusId: string,
    newStatusTasks: TaskWithTag[]
  ) => {
    const targetStatus = sortedStatuses.find((s) => s.id === targetStatusId);
    if (!targetStatus) return;

    const isCompleted = targetStatus.category === "done";
    const targetOrderedIds = newStatusTasks.map((t) => t.id);

    // Optimistically update tasks state
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          return {
            ...t,
            statusId: targetStatusId,
            status: targetStatus,
            completed: isCompleted,
          };
        }
        return t;
      })
    );

    try {
      await moveTaskKanbanAction({
        taskId,
        targetStatusId,
        targetOrderedIds,
      });
    } catch (err) {
      console.error("Error moving task:", err);
    }
  };

  const handleDropOnColumn = (e: React.DragEvent, targetStatusId: string) => {
    e.preventDefault();
    if (!draggedTaskId) return;

    const draggedTask = tasks.find((t) => t.id === draggedTaskId);
    if (!draggedTask) return;

    const currentColumnTasks = tasksByStatus.get(targetStatusId) || [];
    // If card is already in this column and no specific card targeted, keep position or move to end
    const filtered = currentColumnTasks.filter((t) => t.id !== draggedTaskId);
    const updated = [...filtered, draggedTask];

    handleDragEnd();
    executeMoveTask(draggedTaskId, targetStatusId, updated);
  };

  const handleDropOnCard = (
    e: React.DragEvent,
    targetTaskId: string,
    targetStatusId: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedTaskId || draggedTaskId === targetTaskId) {
      handleDragEnd();
      return;
    }

    const draggedTask = tasks.find((t) => t.id === draggedTaskId);
    if (!draggedTask) {
      handleDragEnd();
      return;
    }

    const currentColumnTasks = tasksByStatus.get(targetStatusId) || [];
    const filtered = currentColumnTasks.filter((t) => t.id !== draggedTaskId);
    const targetIndex = filtered.findIndex((t) => t.id === targetTaskId);

    const updated = [...filtered];
    if (targetIndex >= 0) {
      updated.splice(targetIndex, 0, draggedTask);
    } else {
      updated.push(draggedTask);
    }

    handleDragEnd();
    executeMoveTask(draggedTaskId, targetStatusId, updated);
  };

  // Task completion toggle
  const handleToggleCompleted = async (
    e: React.MouseEvent,
    task: TaskWithTag
  ) => {
    e.stopPropagation();
    const nextCompleted = !task.completed;

    let nextStatus = task.status;
    if (nextCompleted && defaultDoneStatus) {
      nextStatus = defaultDoneStatus;
    } else if (!nextCompleted && defaultStatus) {
      nextStatus = defaultStatus;
    }

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? {
              ...t,
              completed: nextCompleted,
              statusId: nextStatus?.id || t.statusId,
              status: nextStatus || t.status,
            }
          : t
      )
    );

    try {
      await toggleTaskStatusAction(task.id, nextCompleted);
    } catch (err) {
      console.error("Error toggling completion:", err);
    }
  };

  // Quick task creation
  const handleQuickAddTask = async (title: string, statusId: string) => {
    try {
      const res = await createTaskAction({
        title,
        statusId,
        workspaceId: activeWorkspaceId,
      });

      if (res.task) {
        setTasks((prev) => [...prev, res.task!]);
      }
    } catch (err) {
      console.error("Error adding quick task:", err);
    }
  };

  // Task click (open modal)
  const handleTaskClick = (task: TaskWithTag) => {
    setSelectedTask(task);
    setIsTaskModalOpen(true);
  };

  const handleTaskUpdated = (updatedTask: TaskWithTag) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === updatedTask.id ? updatedTask : t))
    );
    if (selectedTask?.id === updatedTask.id) {
      setSelectedTask(updatedTask);
    }
  };

  const handleTaskDeleted = (deletedTaskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== deletedTaskId));
    if (selectedTask?.id === deletedTaskId) {
      setSelectedTask(null);
      setIsTaskModalOpen(false);
    }
  };

  // Status management
  const handleOpenCreateStatus = () => {
    setConfigModalMode("create");
    setEditingStatus(null);
    setConfigModalOpen(true);
  };

  const handleOpenEditStatus = (status: TaskStatus) => {
    setConfigModalMode("edit");
    setEditingStatus(status);
    setConfigModalOpen(true);
  };

  const handleSaveStatus = async (data: {
    name: string;
    color: string;
    category?: TaskStatusCategory;
  }) => {
    if (configModalMode === "create") {
      const res = await createTaskStatusAction(data);
      if (res.status) {
        setStatuses((prev) => [...prev, res.status!]);
      }
    } else if (configModalMode === "edit" && editingStatus) {
      const res = await updateTaskStatusAction(editingStatus.id, data);
      if (res.status) {
        setStatuses((prev) =>
          prev.map((s) => (s.id === res.status!.id ? res.status! : s))
        );
        // Sync category changes to tasks
        if (data.category && data.category !== editingStatus.category) {
          const isDone = data.category === "done";
          setTasks((prev) =>
            prev.map((t) =>
              t.statusId === editingStatus.id
                ? { ...t, completed: isDone, status: res.status! }
                : t
            )
          );
        }
      }
    }
  };

  const handleDeleteStatus = async (statusId: string) => {
    const res = await deleteTaskStatusAction(statusId);
    if (res.success) {
      setStatuses((prev) => prev.filter((s) => s.id !== statusId));
      // Reassign affected tasks in local state so they fall back to default
      setTasks((prev) =>
        prev.map((t) => {
          if (t.statusId === statusId) {
            return {
              ...t,
              statusId: null,
              status: null,
            };
          }
          return t;
        })
      );
    }
  };

  return (
    <div className="min-h-screen flex flex-col transition-colors">
      <AppHeader
        userEmail={userEmail}
        isDarkMode={isDarkMode}
        onToggleTheme={handleToggleTheme}
        preferences={preferences}
        onSelectBackground={handleSelectBackground}
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
      >
        <button
          type="button"
          onClick={handleOpenCreateStatus}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white shadow-xs shadow-amber-500/20 transition-all cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Column</span>
        </button>
      </AppHeader>

      {/* Main Kanban Board Canvas */}
      <main className="flex-1 overflow-x-auto px-4 sm:px-6 md:px-8 pb-8 custom-scrollbar">
        <div className="flex items-start gap-4 min-w-max pb-4">
          {sortedStatuses.map((status) => (
            <KanbanColumn
              key={status.id}
              status={status}
              tasks={tasksByStatus.get(status.id) || []}
              draggedTaskId={draggedTaskId}
              dragOverCardId={dragOverCardId}
              isDragOverColumn={dragOverColumnId === status.id}
              onEditStatus={handleOpenEditStatus}
              onQuickAddTask={handleQuickAddTask}
              onTaskClick={handleTaskClick}
              onToggleCompleted={handleToggleCompleted}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragOverCard={handleDragOverCard}
              onDropOnCard={handleDropOnCard}
              onDragOverColumn={handleDragOverColumn}
              onDropOnColumn={handleDropOnColumn}
            />
          ))}

          {/* New Column Quick Trigger Card at the end */}
          <div className="w-64 sm:w-72 flex-shrink-0">
            <button
              type="button"
              onClick={handleOpenCreateStatus}
              className="w-full h-32 rounded-3xl border border-dashed border-slate-300/80 dark:border-slate-700/80 hover:border-amber-400 dark:hover:border-amber-500/60 bg-white/40 hover:bg-white/70 dark:bg-slate-900/30 dark:hover:bg-slate-900/60 transition-all flex flex-col items-center justify-center gap-2 text-slate-500 hover:text-amber-600 dark:text-slate-400 dark:hover:text-amber-400 cursor-pointer shadow-2xs"
            >
              <div className="w-8 h-8 rounded-full bg-slate-200/60 dark:bg-slate-800/80 flex items-center justify-center">
                <Plus className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold">Add Column</span>
            </button>
          </div>
        </div>
      </main>

      {/* Task Modal */}
      {selectedTask && (
        <TaskModal
          key={selectedTask.id}
          task={selectedTask}
          isOpen={isTaskModalOpen}
          onClose={() => {
            setIsTaskModalOpen(false);
            setSelectedTask(null);
          }}
          onTaskUpdated={handleTaskUpdated}
          onTaskDeleted={handleTaskDeleted}
        />
      )}

      {/* Status Configuration Modal */}
      <StatusConfigModal
        isOpen={configModalOpen}
        mode={configModalMode}
        status={editingStatus}
        onClose={() => setConfigModalOpen(false)}
        onSave={handleSaveStatus}
        onDelete={handleDeleteStatus}
      />
    </div>
  );
}
