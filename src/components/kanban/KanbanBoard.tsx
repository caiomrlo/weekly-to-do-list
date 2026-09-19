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
  Project,
} from "@/db/schema";
import { useDarkMode } from "@/lib/hooks/useDarkMode";
import { updateUserPreferencesAction } from "@/app/actions/user";
import {
  createTaskAction,
  getTaskByIdAction,
  toggleTaskStatusAction,
  moveTaskKanbanAction,
} from "@/app/actions/tasks";
import {
  createTaskStatusAction,
  updateTaskStatusAction,
  deleteTaskStatusAction,
} from "@/app/actions/task-statuses";
import { AppHeader } from "@/components/header/AppHeader";
import { TaskModal } from "@/components/task-modal/TaskModal";
import { KanbanColumn } from "./KanbanColumn";
import { StatusConfigModal } from "./StatusConfigModal";
import { KanbanFilters } from "./KanbanFilters";
import {
  KanbanDateFilter,
  KanbanProjectFilter,
  filterKanbanTasks,
} from "@/lib/kanban-filter-utils";
import { Plus } from "lucide-react";
import { useLocalStorage } from "@/lib/hooks/useLocalStorage";
import { MobileBottomNav } from "@/components/navigation/MobileBottomNav";

export interface KanbanBoardProps {
  initialTasks: TaskWithTag[];
  initialStatuses: TaskStatus[];
  initialProjects?: Project[];
  userEmail: string;
  userName?: string;
  userImage?: string | null;
  userAvatarColor?: string | null;
  userId?: string;
  initialPreferences?: UserPreferences;
  workspaces?: Workspace[];
  activeWorkspaceId?: string;
}

export function KanbanBoard({
  initialTasks,
  initialStatuses,
  initialProjects,
  userEmail,
  userName,
  userImage,
  userAvatarColor,
  userId,
  initialPreferences,
  workspaces,
  activeWorkspaceId,
}: KanbanBoardProps) {
  const [preferences, setPreferences] = useState<UserPreferences>(
    initialPreferences || DEFAULT_USER_PREFERENCES
  );
  const [tasks, setTasks] = useState<TaskWithTag[]>(initialTasks);
  const [statuses, setStatuses] = useState<TaskStatus[]>(initialStatuses);
  const collapseRecurring = true;

  const [projects, setProjects] = useState<Project[]>(initialProjects || []);
  const [selectedProjectId, handleSelectProject] = useLocalStorage<KanbanProjectFilter>(
    "kanban_project_filter",
    "all"
  );
  const [dateFilter, handleSelectDateFilter] = useLocalStorage<KanbanDateFilter>(
    "kanban_date_filter",
    "default",
    (val) => ["default", "this_week", "this_month", "all"].includes(val)
  );

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

  // Group tasks by status ID with fallback and optional recurrence collapsing
  const tasksByStatus = useMemo(() => {
    const map = new Map<string, TaskWithTag[]>();
    for (const status of sortedStatuses) {
      map.set(status.id, []);
    }

    const filteredTasks = filterKanbanTasks(tasks, {
      dateFilter,
      projectFilter: selectedProjectId,
    });

    let candidateTasks = filteredTasks;

    if (collapseRecurring) {
      const nonRecurring: TaskWithTag[] = [];
      const recurringGroups = new Map<string, TaskWithTag[]>();

      for (const task of filteredTasks) {
        if (!task.recurringRuleId) {
          nonRecurring.push(task);
        } else {
          const group = recurringGroups.get(task.recurringRuleId) || [];
          group.push(task);
          recurringGroups.set(task.recurringRuleId, group);
        }
      }

      const collapsedRecurring: TaskWithTag[] = [];

      for (const group of recurringGroups.values()) {
        const uncompleted: TaskWithTag[] = [];
        const completed: TaskWithTag[] = [];

        for (const task of group) {
          const statusCat =
            task.status?.category ||
            (task.statusId && statuses.find((s) => s.id === task.statusId)?.category);
          const isDone = task.completed || statusCat === "done";
          if (isDone) {
            completed.push(task);
          } else {
            uncompleted.push(task);
          }
        }

        // Earliest uncompleted occurrence first (current/next upcoming task)
        if (uncompleted.length > 0) {
          uncompleted.sort((a, b) => {
            const dateA = a.date || a.originalDate || "9999-99-99";
            const dateB = b.date || b.originalDate || "9999-99-99";
            if (dateA !== dateB) return dateA.localeCompare(dateB);
            return a.order - b.order;
          });
          collapsedRecurring.push(uncompleted[0]);
        }

        // Most recent completed occurrence (shown in Done column)
        if (completed.length > 0) {
          completed.sort((a, b) => {
            const dateA = a.date || a.originalDate || "";
            const dateB = b.date || b.originalDate || "";
            if (dateA !== dateB) return dateB.localeCompare(dateA);
            const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
            const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
            return timeB - timeA;
          });
          collapsedRecurring.push(completed[0]);
        }
      }

      candidateTasks = [...nonRecurring, ...collapsedRecurring];
    }

    for (const task of candidateTasks) {
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
  }, [
    tasks,
    sortedStatuses,
    defaultStatus,
    defaultDoneStatus,
    collapseRecurring,
    statuses,
    dateFilter,
    selectedProjectId,
  ]);

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
      const assignedProjectId =
        selectedProjectId !== "all" && selectedProjectId !== "none"
          ? selectedProjectId
          : undefined;

      const res = await createTaskAction({
        title,
        statusId,
        projectId: assignedProjectId,
        workspaceId: activeWorkspaceId,
      });

      if (res.task) {
        setTasks((prev) => [...prev, res.task!]);
      }
    } catch (err) {
      console.error("Error adding quick task:", err);
    }
  };

  const handleOpenTask = async (taskOrId: TaskWithTag | string) => {
    if (typeof taskOrId === "string") {
      const found = tasks.find((t) => t.id === taskOrId);
      if (found) {
        setSelectedTask(found);
        setIsTaskModalOpen(true);
      } else {
        const res = await getTaskByIdAction(taskOrId);
        if (res.task) {
          setSelectedTask(res.task);
          setIsTaskModalOpen(true);
        }
      }
    } else {
      setSelectedTask(taskOrId);
      setIsTaskModalOpen(true);
    }
  };

  // Task click (open modal)
  const handleTaskClick = (task: TaskWithTag) => {
    handleOpenTask(task);
  };

  const handleTaskUpdated = async (updatedTask: TaskWithTag) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === updatedTask.id ? updatedTask : t))
    );
    if (selectedTask?.id === updatedTask.id) {
      setSelectedTask(updatedTask);
    }
    if (updatedTask.parentId) {
      const res = await getTaskByIdAction(updatedTask.parentId);
      if (res.task) {
        const parentTask = res.task;
        setTasks((prev) =>
          prev.map((t) => (t.id === parentTask.id ? parentTask : t))
        );
      }
    }
  };

  const handleTaskDeleted = async (deletedTaskId: string) => {
    const parentId =
      selectedTask?.id === deletedTaskId ? selectedTask.parentId : null;

    setTasks((prev) => prev.filter((t) => t.id !== deletedTaskId));
    if (selectedTask?.id === deletedTaskId) {
      setSelectedTask(null);
      setIsTaskModalOpen(false);
    }

    if (parentId) {
      const res = await getTaskByIdAction(parentId);
      if (res.task) {
        const parentTask = res.task;
        setTasks((prev) =>
          prev.map((t) => (t.id === parentTask.id ? parentTask : t))
        );
      }
    }
  };

  const handleProjectUpdated = (updatedProject: Project) => {
    setProjects((prev) => {
      const exists = prev.some((p) => p.id === updatedProject.id);
      if (exists) {
        return prev.map((p) => (p.id === updatedProject.id ? updatedProject : p));
      }
      return [...prev, updatedProject];
    });
    setTasks((prev) =>
      prev.map((t) =>
        t.projectId === updatedProject.id
          ? { ...t, project: updatedProject }
          : t
      )
    );
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
        userName={userName}
        userImage={userImage}
        userAvatarColor={userAvatarColor}
        userId={userId}
        isDarkMode={isDarkMode}
        onToggleTheme={handleToggleTheme}
        preferences={preferences}
        onSelectBackground={handleSelectBackground}
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <KanbanFilters
            projects={projects}
            selectedProjectId={selectedProjectId}
            onSelectProject={handleSelectProject}
            dateFilter={dateFilter}
            onSelectDateFilter={handleSelectDateFilter}
          />

          <button
            type="button"
            onClick={handleOpenCreateStatus}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white shadow-xs shadow-amber-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Column</span>
          </button>
        </div>
      </AppHeader>

      {/* Main Kanban Board Canvas */}
      <main className="flex-1 overflow-x-auto px-4 sm:px-6 md:px-8 pb-20 md:pb-8 custom-scrollbar">
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
          onOpenTask={handleOpenTask}
          onProjectUpdated={handleProjectUpdated}
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

      {/* Mobile Bottom Navigation Bar */}
      <MobileBottomNav />
    </div>
  );
}
