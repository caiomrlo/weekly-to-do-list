"use client";

import { useState, useTransition, useMemo, useRef, useEffect } from "react";
import { TaskWithTag, UserPreferences, DEFAULT_USER_PREFERENCES } from "@/db/schema";
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
import { updateUserPreferencesAction } from "@/app/actions/user";
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
  SlidersHorizontal,
} from "lucide-react";

interface WeeklyBoardProps {
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
  const [isViewMenuOpen, setIsViewMenuOpen] = useState(false);
  const viewMenuRef = useRef<HTMLDivElement>(null);

  const [tasks, setTasks] = useState<TaskWithTag[]>(initialTasks);
  const [selectedTask, setSelectedTask] = useState<TaskWithTag | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New task inline input state per day: { [dateStr]: string }
  const [newTitles, setNewTitles] = useState<Record<string, string>>({});
  const [isNavigating, startNavTransition] = useTransition();

  // Close view menu on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        viewMenuRef.current &&
        !viewMenuRef.current.contains(event.target as Node)
      ) {
        setIsViewMenuOpen(false);
      }
    }

    if (isViewMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isViewMenuOpen]);

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

  // Calculate the 7 days of current week
  const weekDays = useMemo(() => getWeekDays(currentMonday), [currentMonday]);

  // Filter visible days based on user preferences (Saturday and Sunday hidden by default)
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

            {/* View Settings Popover */}
            <div className="relative" ref={viewMenuRef}>
              <button
                type="button"
                onClick={() => setIsViewMenuOpen((prev) => !prev)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium shadow-xs transition-all cursor-pointer ${
                  isViewMenuOpen || preferences.showSaturday || preferences.showSunday
                    ? "bg-indigo-50/90 text-indigo-700 border-indigo-200/80"
                    : "bg-white/70 hover:bg-white text-slate-600 hover:text-slate-900 border-slate-200/70"
                }`}
                title="Ajustes de visualização dos dias"
                aria-label="Ajustes de visualização dos dias"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Visualização</span>
                {(preferences.showSaturday || preferences.showSunday) && (
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                )}
              </button>

              {isViewMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 p-3 rounded-2xl glass-panel shadow-xl border border-white/80 bg-white/95 backdrop-blur-md z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="pb-2 mb-2 border-b border-slate-200/60 flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-800">Dias da Semana</p>
                    <span className="text-[10px] text-slate-500 font-medium">
                      {visibleWeekDays.length} de 7 dias
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {/* Seg a Sex indicator */}
                    <div className="px-2 py-1.5 text-[11px] text-slate-500 bg-slate-100/60 rounded-lg flex items-center justify-between">
                      <span>Segunda – Sexta</span>
                      <span className="font-semibold text-slate-400 text-[10px]">Padrão</span>
                    </div>

                    {/* Sábado Switch */}
                    <button
                      type="button"
                      onClick={() => handleToggleDay("showSaturday")}
                      className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-100/70 cursor-pointer transition-colors text-left"
                    >
                      <span className="text-xs font-medium text-slate-700">Sábado</span>
                      <div
                        className={`w-8 h-[18px] flex items-center rounded-full p-0.5 transition-colors duration-200 ease-in-out ${
                          preferences.showSaturday ? "bg-indigo-600" : "bg-slate-300"
                        }`}
                      >
                        <div
                          className={`bg-white w-3.5 h-3.5 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                            preferences.showSaturday ? "translate-x-3.5" : "translate-x-0"
                          }`}
                        />
                      </div>
                    </button>

                    {/* Domingo Switch */}
                    <button
                      type="button"
                      onClick={() => handleToggleDay("showSunday")}
                      className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-100/70 cursor-pointer transition-colors text-left"
                    >
                      <span className="text-xs font-medium text-slate-700">Domingo</span>
                      <div
                        className={`w-8 h-[18px] flex items-center rounded-full p-0.5 transition-colors duration-200 ease-in-out ${
                          preferences.showSunday ? "bg-indigo-600" : "bg-slate-300"
                        }`}
                      >
                        <div
                          className={`bg-white w-3.5 h-3.5 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                            preferences.showSunday ? "translate-x-3.5" : "translate-x-0"
                          }`}
                        />
                      </div>
                    </button>
                  </div>
                </div>
              )}
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

      {/* Main Board Container */}
      <main className="flex-1 px-3 sm:px-6 pb-8 w-full">
        <div className={`grid grid-cols-1 md:grid-cols-2 ${gridColsClass} gap-3.5 items-start`}>
          {visibleWeekDays.map((day) => {
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

