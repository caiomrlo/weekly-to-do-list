"use client";

import { useState, useTransition, useMemo } from "react";
import { TaskWithTag } from "@/db/schema";
import {
  getMondayOfWeek,
  getWeekDays,
  formatMonthYear,
  toDateString,
  formatDuration,
} from "@/lib/date-utils";
import {
  getWeekTasksAction,
  createTaskAction,
  toggleTaskStatusAction,
} from "@/app/actions/tasks";
import { logoutAction } from "@/app/actions/auth";
import { getTagColorStyles } from "@/lib/tag-utils";
import { TaskModal } from "./TaskModal";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Circle,
  Clock,
  Timer,
  Plus,
  LogOut,
  CalendarDays,
} from "lucide-react";

interface WeeklyBoardProps {
  initialTasks: TaskWithTag[];
  userEmail: string;
  initialMondayStr: string; // 'YYYY-MM-DD'
}

export function WeeklyBoard({
  initialTasks,
  userEmail,
  initialMondayStr,
}: WeeklyBoardProps) {
  // Current monday date object
  const [currentMonday, setCurrentMonday] = useState<Date>(() => {
    const [y, m, d] = initialMondayStr.split("-").map(Number);
    return new Date(y, m - 1, d);
  });

  const [tasks, setTasks] = useState<TaskWithTag[]>(initialTasks);
  const [selectedTask, setSelectedTask] = useState<TaskWithTag | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New task inline input state per day: { [dateStr]: string }
  const [newTitles, setNewTitles] = useState<Record<string, string>>({});
  const [isNavigating, startNavTransition] = useTransition();

  // Calculate the 7 days of current week
  const weekDays = useMemo(() => getWeekDays(currentMonday), [currentMonday]);

  // Load tasks when week changes
  const fetchWeekTasks = (monday: Date) => {
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
  };

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
      if (map[t.date]) {
        map[t.date].push(t);
      }
    });

    return map;
  }, [weekDays, tasks]);

  // Handle inline quick add task
  const handleQuickAdd = async (dateStr: string) => {
    const title = (newTitles[dateStr] || "").trim();
    if (!title) return;

    // Reset input
    setNewTitles((prev) => ({ ...prev, [dateStr]: "" }));

    // Optimistic temporary task
    const tempId = `temp-${crypto.randomUUID()}`;
    const optimisticTask: TaskWithTag = {
      id: tempId,
      userId: "",
      tagId: null,
      tag: null,
      title,
      content: "",
      date: dateStr,
      time: null,
      duration: null,
      completed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    setTasks((prev) => [...prev, optimisticTask]);

    const res = await createTaskAction({ title, date: dateStr });
    if (res.task) {
      setTasks((prev) =>
        prev.map((t) => (t.id === tempId ? res.task! : t))
      );
    } else {
      // Revert if error
      setTasks((prev) => prev.filter((t) => t.id !== tempId));
    }
  };

  // Toggle completed status (maintaining order as decided)
  const handleToggleCompleted = async (
    e: React.MouseEvent,
    taskToToggle: TaskWithTag
  ) => {
    e.stopPropagation();
    const newCompleted = !taskToToggle.completed;

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskToToggle.id ? { ...t, completed: newCompleted } : t
      )
    );

    if (selectedTask && selectedTask.id === taskToToggle.id) {
      setSelectedTask((prev) => (prev ? { ...prev, completed: newCompleted } : null));
    }

    await toggleTaskStatusAction(taskToToggle.id, newCompleted);
  };

  // Open modal
  const handleOpenTask = (task: TaskWithTag) => {
    setSelectedTask(task);
    setIsModalOpen(true);
  };

  // Modal updates
  const handleTaskUpdated = (updatedTask: TaskWithTag) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === updatedTask.id ? updatedTask : t))
    );
    setSelectedTask(updatedTask);
  };

  const handleTaskDeleted = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    if (selectedTask?.id === taskId) {
      setIsModalOpen(false);
      setSelectedTask(null);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Top Glassmorphic Navigation Bar */}
      <header className="sticky top-0 z-30 px-4 sm:px-8 py-3.5 glass-panel border-b border-white/60 mb-6">
        <div className="w-full flex items-center justify-between gap-4">
          {/* Month & Year Title (Left) */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 flex-shrink-0">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight">
                {formatMonthYear(currentMonday)}
              </h1>
            </div>
          </div>

          {/* Right Controls: Week Navigation + User Avatar Circle + Logout */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Week Navigation Controls */}
            <div className="flex items-center gap-1 sm:gap-1.5">
              <button
                type="button"
                onClick={handlePrevWeek}
                disabled={isNavigating}
                className="p-2 rounded-xl bg-white/70 hover:bg-white text-slate-600 hover:text-slate-900 border border-slate-200/70 shadow-xs transition-all cursor-pointer disabled:opacity-50"
                title="Semana anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleGoToday}
                disabled={isNavigating}
                className="px-3.5 py-1.5 rounded-xl bg-indigo-50/80 hover:bg-indigo-100/90 text-indigo-700 font-semibold text-xs border border-indigo-200/60 shadow-xs transition-all cursor-pointer"
              >
                Hoje
              </button>

              <button
                type="button"
                onClick={handleNextWeek}
                disabled={isNavigating}
                className="p-2 rounded-xl bg-white/70 hover:bg-white text-slate-600 hover:text-slate-900 border border-slate-200/70 shadow-xs transition-all cursor-pointer disabled:opacity-50"
                title="Próxima semana"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Separator */}
            <div className="h-5 w-px bg-slate-200/80 mx-1 hidden sm:block" />

            {/* User Avatar Circle */}
            <div
              className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 text-white font-bold text-xs flex items-center justify-center shadow-xs select-none uppercase flex-shrink-0"
              title={userEmail}
            >
              {userEmail ? userEmail.charAt(0).toUpperCase() : "U"}
            </div>

            {/* Logout Button (Icon only) */}
            <form action={logoutAction}>
              <button
                type="submit"
                className="p-2 text-slate-500 hover:text-rose-600 bg-white/60 hover:bg-rose-50/80 rounded-xl border border-slate-200/70 transition-colors cursor-pointer flex items-center justify-center"
                title="Encerrar sessão"
                aria-label="Encerrar sessão"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Main 7-Days Board Container */}
      <main className="flex-1 px-3 sm:px-6 pb-8 w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3.5 items-start">
          {weekDays.map((day) => {
            const dayTasks = tasksByDay[day.dateStr] || [];
            const completedCount = dayTasks.filter((t) => t.completed).length;

            return (
              <div
                key={day.dateStr}
                className={`rounded-2xl flex flex-col min-h-[480px] p-3.5 transition-all duration-200 ${
                  day.isToday ? "glass-card-today ring-1 ring-indigo-500/20" : "glass-card"
                }`}
              >
                {/* Column Day Header */}
                <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-200/40">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-bold ${
                        day.isToday ? "text-indigo-600" : "text-slate-800"
                      }`}
                    >
                      {day.dayNameShort}
                    </span>
                    <span className="text-xs font-medium text-slate-500">
                      {day.dayNumber} {day.monthNameShort}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {dayTasks.length > 0 && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">
                        {completedCount}/{dayTasks.length}
                      </span>
                    )}
                  </div>
                </div>

                {/* Tasks List for the Day */}
                <div className="flex-1 space-y-2 overflow-y-auto max-h-[560px] pr-0.5">
                  {dayTasks.map((t) => {
                    const tagStyles = t.tag ? getTagColorStyles(t.tag.color) : null;

                    return (
                      <div
                        key={t.id}
                        onClick={() => handleOpenTask(t)}
                        className={`group relative flex items-start gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer ${
                          t.completed
                            ? "bg-slate-50/50 border-slate-200/40 text-slate-400"
                            : "bg-white/85 hover:bg-white border-slate-200/60 text-slate-800 hover:shadow-xs hover:border-indigo-200"
                        }`}
                      >
                        {/* Checkbox */}
                        <button
                          type="button"
                          onClick={(e) => handleToggleCompleted(e, t)}
                          className="mt-0.5 text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer flex-shrink-0"
                        >
                          {t.completed ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <Circle className="w-4 h-4 text-slate-300 hover:text-indigo-500" />
                          )}
                        </button>

                        {/* Title and details */}
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-xs font-medium leading-snug break-words ${
                              t.completed
                                ? "line-through text-slate-400"
                                : "text-slate-700"
                            }`}
                          >
                            {t.title}
                          </p>

                          {/* Tag, Time & Duration Badges row */}
                          {(t.tag || t.time || (t.duration && t.duration > 0)) && (
                            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                              {/* Tag badge */}
                              {t.tag && tagStyles && (
                                <span
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium border shadow-2xs ${
                                    t.completed
                                      ? "bg-slate-100/80 text-slate-400 border-slate-200/50"
                                      : tagStyles.badgeClass
                                  }`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      t.completed ? "bg-slate-400" : tagStyles.dotClass
                                    }`}
                                  />
                                  <span className="truncate max-w-[110px]">
                                    {t.tag.name}
                                  </span>
                                </span>
                              )}

                              {/* Time badge */}
                              {t.time && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 font-medium">
                                  <Clock className="w-2.5 h-2.5 text-indigo-400" />
                                  {t.time}
                                </span>
                              )}

                              {/* Duration badge */}
                              {t.duration && t.duration > 0 ? (
                                <span
                                  className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md border shadow-2xs ${
                                    t.completed
                                      ? "bg-slate-100/80 text-slate-400 border-slate-200/50"
                                      : "bg-amber-50/90 text-amber-700 border-amber-200/60"
                                  }`}
                                  title={`Duração estimada: ${formatDuration(t.duration)}`}
                                >
                                  <Timer className={`w-2.5 h-2.5 ${t.completed ? "text-slate-400" : "text-amber-500"}`} />
                                  {formatDuration(t.duration)}
                                </span>
                              ) : null}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Inline Quick Add Input immediately below the last task (or at start if 0 tasks) */}
                  <div className="pt-0.5">
                    <div className="relative">
                      <input
                        type="text"
                        value={newTitles[day.dateStr] || ""}
                        onChange={(e) =>
                          setNewTitles((prev) => ({
                            ...prev,
                            [day.dateStr]: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleQuickAdd(day.dateStr);
                          }
                        }}
                        placeholder="+ Nova tarefa"
                        className="w-full text-xs bg-white/70 hover:bg-white focus:bg-white border border-slate-200/60 rounded-xl pl-3 pr-8 py-2 text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all shadow-2xs"
                      />
                      {(newTitles[day.dateStr] || "").trim() && (
                        <button
                          type="button"
                          onClick={() => handleQuickAdd(day.dateStr)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-indigo-600 hover:text-indigo-700 p-0.5 cursor-pointer"
                          title="Adicionar"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
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
      />
    </div>
  );
}

