"use client";

import { useState, useTransition, useMemo, useEffect, useCallback } from "react";
import {
  TaskWithTag,
  UserPreferences,
  DEFAULT_USER_PREFERENCES,
} from "@/db/schema";
import {
  getMondayOfWeek,
  getWeekDays,
  toDateString,
} from "@/lib/date-utils";
import {
  getWeekTasksAction,
  createTaskAction,
  toggleTaskStatusAction,
  getTaskByIdAction,
} from "@/app/actions/tasks";
import { updateUserPreferencesAction } from "@/app/actions/user";
import { useTodayDateStr } from "@/lib/hooks/useTodayDateStr";
import { useDarkMode } from "@/lib/hooks/useDarkMode";
import { useBoardDnD } from "./board/hooks/useBoardDnD";
import { WeeklyHeader } from "./board/WeeklyHeader";
import { DayColumn } from "./board/DayColumn";
import { UnscheduledSection } from "./board/UnscheduledSection";
import { TaskModal } from "./TaskModal";

export interface WeeklyBoardProps {
  initialTasks: TaskWithTag[];
  userEmail: string;
  initialMondayStr: string; // 'YYYY-MM-DD'
  initialPreferences?: UserPreferences;
}

export function WeeklyBoard({
  initialTasks,
  userEmail,
  initialMondayStr,
  initialPreferences,
}: WeeklyBoardProps) {
  // Current monday date object
  const [currentMonday, setCurrentMonday] = useState<Date>(() => {
    const [y, m, d] = initialMondayStr.split("-").map(Number);
    return new Date(y, m - 1, d);
  });

  const [preferences, setPreferences] = useState<UserPreferences>(
    initialPreferences || DEFAULT_USER_PREFERENCES
  );

  const [tasks, setTasks] = useState<TaskWithTag[]>(initialTasks);
  const [selectedTask, setSelectedTask] = useState<TaskWithTag | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New task inline input state per day: { [dateStr]: string }
  const [newTitles, setNewTitles] = useState<Record<string, string>>({});
  const [isNavigating, startNavTransition] = useTransition();
  const [isUnscheduledOpen, setIsUnscheduledOpen] = useState(true);

  // Drag and drop engine
  const dnd = useBoardDnD({ tasks, setTasks });

  // Theme mode state synced with DOM and server
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
      console.error("Erro ao salvar preferência de tema:", err);
    }
  };

  // Toggle visible day setting
  const handleToggleDay = async (dayKey: "showSaturday" | "showSunday") => {
    const nextVal = !preferences[dayKey];
    const updated = { ...preferences, [dayKey]: nextVal };
    setPreferences(updated);

    try {
      await updateUserPreferencesAction({ [dayKey]: nextVal });
    } catch (err) {
      console.error("Erro ao salvar preferências:", err);
    }
  };

  // Client-side today date string from synchronized store
  const todayStr = useTodayDateStr();

  // Load tasks when week changes
  const fetchWeekTasks = useCallback((monday: Date) => {
    const start = toDateString(monday);
    const end = toDateString(
      new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6)
    );

    startNavTransition(async () => {
      const res = await getWeekTasksAction(start, end);
      if (res.tasks) {
        setTasks(res.tasks);
      }
    });
  }, []);

  // Save client timezone in cookie and synchronize week boundary if client timezone differs
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) {
        document.cookie = `user_tz=${encodeURIComponent(tz)}; path=/; max-age=31536000; SameSite=Lax`;
      }
    } catch {}

    const clientMonday = getMondayOfWeek(new Date());
    const clientMondayStr = toDateString(clientMonday);
    if (clientMondayStr !== initialMondayStr) {
      const timer = setTimeout(() => {
        setCurrentMonday(clientMonday);
        fetchWeekTasks(clientMonday);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [initialMondayStr, fetchWeekTasks]);

  // Calculate the 7 days of current week
  const weekDays = useMemo(
    () => getWeekDays(currentMonday, todayStr),
    [currentMonday, todayStr]
  );

  // Filter visible days based on user preferences
  const visibleWeekDays = useMemo(() => {
    return weekDays.filter((day) => {
      if (day.dayOfWeek === 6 && !preferences.showSaturday) return false;
      if (day.dayOfWeek === 0 && !preferences.showSunday) return false;
      return true;
    });
  }, [weekDays, preferences.showSaturday, preferences.showSunday]);

  // Dynamic grid column class based on count of visible days
  const gridColsClass = useMemo(() => {
    switch (visibleWeekDays.length) {
      case 5:
        return "lg:grid-cols-5";
      case 6:
        return "lg:grid-cols-6";
      case 7:
      default:
        return "lg:grid-cols-7";
    }
  }, [visibleWeekDays.length]);

  // Week navigation
  const handlePrevWeek = () => {
    const newMon = new Date(
      currentMonday.getFullYear(),
      currentMonday.getMonth(),
      currentMonday.getDate() - 7
    );
    setCurrentMonday(newMon);
    fetchWeekTasks(newMon);
  };

  const handleNextWeek = () => {
    const newMon = new Date(
      currentMonday.getFullYear(),
      currentMonday.getMonth(),
      currentMonday.getDate() + 7
    );
    setCurrentMonday(newMon);
    fetchWeekTasks(newMon);
  };

  const handleGoToday = () => {
    const todayMon = getMondayOfWeek(new Date());
    setCurrentMonday(todayMon);
    fetchWeekTasks(todayMon);
  };

  // Group tasks by day ('YYYY-MM-DD')
  const tasksByDay = useMemo(() => {
    const map: Record<string, TaskWithTag[]> = {};
    weekDays.forEach((day) => {
      map[day.dateStr] = [];
    });

    tasks.forEach((t) => {
      if (t.date && map[t.date]) {
        map[t.date].push(t);
      }
    });

    Object.keys(map).forEach((dateKey) => {
      map[dateKey].sort((a, b) => {
        const orderDiff = (a.order ?? 0) - (b.order ?? 0);
        if (orderDiff !== 0) return orderDiff;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
    });

    return map;
  }, [weekDays, tasks]);

  // Unscheduled backlog tasks
  const unscheduledTasks = useMemo(() => {
    return tasks
      .filter((t) => !t.date && !t.parentId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [tasks]);

  const pendingUnscheduledCount = useMemo(() => {
    return unscheduledTasks.filter((t) => !t.completed).length;
  }, [unscheduledTasks]);

  // Handle inline quick add task
  const handleQuickAdd = useCallback(async (dateStr: string) => {
    const title = (newTitles[dateStr] || "").trim();
    if (!title) return;

    setNewTitles((prev) => ({ ...prev, [dateStr]: "" }));

    const isUnscheduled = !dateStr || dateStr === "unscheduled";
    const targetDate = isUnscheduled ? null : dateStr;

    const tempId = `temp-${Date.now()}`;
    const optimisticTask: TaskWithTag = {
      id: tempId,
      userId: "",
      tagId: null,
      projectId: null,
      parentId: null,
      parent: null,
      tag: null,
      project: null,
      title,
      content: "",
      date: targetDate,
      time: null,
      duration: null,
      completed: false,
      order: tasks.filter(
        (t) => (targetDate ? t.date === targetDate : !t.date) && !t.parentId
      ).length,
      createdAt: new Date(),
      updatedAt: new Date(),
      subtaskCount: 0,
      completedSubtaskCount: 0,
    };

    setTasks((prev) => [...prev, optimisticTask]);

    const res = await createTaskAction({ title, date: targetDate });
    if (res.task) {
      setTasks((prev) =>
        prev.map((t) => (t.id === tempId ? res.task! : t))
      );
    } else {
      setTasks((prev) => prev.filter((t) => t.id !== tempId));
    }
  }, [newTitles, tasks]);

  // Toggle completed status
  const handleToggleCompleted = async (
    e: React.MouseEvent,
    taskToToggle: TaskWithTag
  ) => {
    e.stopPropagation();
    const newCompleted = !taskToToggle.completed;

    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskToToggle.id ? { ...t, completed: newCompleted } : t
      )
    );

    if (selectedTask && selectedTask.id === taskToToggle.id) {
      setSelectedTask((prev) =>
        prev ? { ...prev, completed: newCompleted } : null
      );
    }

    await toggleTaskStatusAction(taskToToggle.id, newCompleted);
  };

  // Open modal (supports passing TaskWithTag or taskId string for deep links)
  const handleOpenTask = async (taskOrId: TaskWithTag | string) => {
    if (dnd.isDragCooldownRef.current) return;

    if (typeof taskOrId === "string") {
      const found = tasks.find((t) => t.id === taskOrId);
      if (found) {
        setSelectedTask(found);
        setIsModalOpen(true);
      } else {
        const res = await getTaskByIdAction(taskOrId);
        if (res.task) {
          setSelectedTask(res.task);
          setIsModalOpen(true);
        }
      }
    } else {
      setSelectedTask(taskOrId);
      setIsModalOpen(true);
    }
  };

  // Subtask created inside modal
  const handleSubtaskCreated = (newSub: TaskWithTag) => {
    setTasks((prev) => {
      const exists = prev.some((t) => t.id === newSub.id);
      const next = exists
        ? prev.map((t) => (t.id === newSub.id ? newSub : t))
        : [...prev, newSub];
      return next.map((t) => {
        if (t.id === newSub.parentId) {
          return {
            ...t,
            subtaskCount: (t.subtaskCount || 0) + 1,
          };
        }
        return t;
      });
    });
  };

  // Task updated inside modal
  const handleTaskUpdated = (updatedTask: TaskWithTag) => {
    setTasks((prev) => {
      const mapped = prev.map((t) =>
        t.id === updatedTask.id ? updatedTask : t
      );
      if (updatedTask.parentId) {
        const parentSubs = mapped.filter(
          (t) => t.parentId === updatedTask.parentId
        );
        const completedCount = parentSubs.filter((t) => t.completed).length;
        return mapped.map((t) =>
          t.id === updatedTask.parentId
            ? { ...t, completedSubtaskCount: completedCount }
            : t
        );
      }
      return mapped;
    });
    setSelectedTask(updatedTask);
  };

  // Task deleted inside modal
  const handleTaskDeleted = (taskId: string) => {
    setTasks((prev) => {
      const filtered = prev.filter(
        (t) => t.id !== taskId && t.parentId !== taskId
      );
      const deletedTask = prev.find((t) => t.id === taskId);
      if (deletedTask?.parentId) {
        const remainingParentSubs = filtered.filter(
          (t) => t.parentId === deletedTask.parentId
        );
        const completedCount = remainingParentSubs.filter(
          (t) => t.completed
        ).length;
        return filtered.map((t) =>
          t.id === deletedTask.parentId
            ? {
                ...t,
                subtaskCount: remainingParentSubs.length,
                completedSubtaskCount: completedCount,
              }
            : t
        );
      }
      return filtered;
    });

    if (selectedTask?.id === taskId) {
      setIsModalOpen(false);
      setSelectedTask(null);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Top Glassmorphic Navigation Bar */}
      <WeeklyHeader
        currentMonday={currentMonday}
        userEmail={userEmail}
        isNavigating={isNavigating}
        isDarkMode={isDarkMode}
        preferences={preferences}
        visibleDaysCount={visibleWeekDays.length}
        onPrevWeek={handlePrevWeek}
        onNextWeek={handleNextWeek}
        onGoToday={handleGoToday}
        onToggleTheme={handleToggleTheme}
        onToggleDay={handleToggleDay}
      />

      {/* Main Board Container */}
      <main className="flex-1 px-3 sm:px-6 pb-8 w-full">
        <div
          className={`grid grid-cols-1 md:grid-cols-2 ${gridColsClass} gap-3.5 items-start`}
        >
          {visibleWeekDays.map((day) => (
            <DayColumn
              key={day.dateStr}
              day={day}
              tasks={tasksByDay[day.dateStr] || []}
              dnd={dnd}
              quickAddTitle={newTitles[day.dateStr] || ""}
              onQuickAddChange={(val) =>
                setNewTitles((prev) => ({ ...prev, [day.dateStr]: val }))
              }
              onQuickAddSubmit={() => handleQuickAdd(day.dateStr)}
              onOpenTask={handleOpenTask}
              onToggleCompleted={handleToggleCompleted}
            />
          ))}
        </div>

        {/* Persistent Collapsible Unscheduled Tasks Section */}
        <UnscheduledSection
          tasks={tasks}
          unscheduledTasks={unscheduledTasks}
          pendingCount={pendingUnscheduledCount}
          isOpen={isUnscheduledOpen}
          onToggleOpen={() => setIsUnscheduledOpen((prev) => !prev)}
          quickAddTitle={newTitles["unscheduled"] || ""}
          onQuickAddChange={(val) =>
            setNewTitles((prev) => ({ ...prev, unscheduled: val }))
          }
          onQuickAddSubmit={() => handleQuickAdd("unscheduled")}
          dnd={dnd}
          onOpenTask={handleOpenTask}
          onToggleCompleted={handleToggleCompleted}
        />
      </main>

      {/* Task Details Modal */}
      <TaskModal
        task={selectedTask}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedTask(null);
        }}
        onTaskUpdated={handleTaskUpdated}
        onTaskDeleted={handleTaskDeleted}
        onOpenTask={handleOpenTask}
        onSubtaskCreated={handleSubtaskCreated}
      />
    </div>
  );
}
