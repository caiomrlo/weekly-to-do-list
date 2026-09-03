"use client";

import { useState, useTransition, useMemo } from "react";
import { Task } from "@/db/schema";
import {
  getMondayOfWeek,
  getWeekDays,
  formatWeekRange,
  toDateString,
} from "@/lib/date-utils";
import {
  getWeekTasksAction,
  createTaskAction,
  toggleTaskStatusAction,
} from "@/app/actions/tasks";
import { logoutAction } from "@/app/actions/auth";
import { TaskModal } from "./TaskModal";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Circle,
  Clock,
  Plus,
  LogOut,
  CalendarDays,
} from "lucide-react";

interface WeeklyBoardProps {
  initialTasks: Task[];
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

  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
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
    const map: Record<string, Task[]> = {};
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
    const optimisticTask: Task = {
      id: tempId,
      userId: "",
      title,
      content: "",
      date: dateStr,
      time: null,
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
    taskToToggle: Task
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
  const handleOpenTask = (task: Task) => {
    setSelectedTask(task);
    setIsModalOpen(true);
  };

  // Modal updates
  const handleTaskUpdated = (updatedTask: Task) => {
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
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Logo & App Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                Weekly To-Do
              </h1>
              <p className="text-xs text-slate-500 font-medium hidden sm:block">
                Planejamento Semanal
              </p>
            </div>
          </div>

          {/* Week Navigation Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2.5">
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

            <div className="ml-2 pl-3 border-l border-slate-200/80 text-center sm:text-left">
              <span className="text-xs sm:text-sm font-semibold text-slate-800">
                {formatWeekRange(currentMonday)}
              </span>
            </div>
          </div>

          {/* User Info & Logout */}
          <div className="flex items-center gap-3">
            <span
              className="text-xs text-slate-500 max-w-[150px] truncate hidden md:inline-block"
              title={userEmail}
            >
              {userEmail}
            </span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-rose-600 bg-white/60 hover:bg-rose-50/80 px-3 py-1.5 rounded-xl border border-slate-200/70 transition-colors cursor-pointer"
                title="Encerrar sessão"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sair</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Main 7-Days Board Container */}
      <main className="flex-1 px-3 sm:px-6 pb-8 max-w-7xl mx-auto w-full">
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
                    {day.isToday && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                        Hoje
                      </span>
                    )}
                    {dayTasks.length > 0 && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">
                        {completedCount}/{dayTasks.length}
                      </span>
                    )}
                  </div>
                </div>

                {/* Tasks List for the Day */}
                <div className="flex-1 space-y-2 overflow-y-auto max-h-[520px] pr-0.5">
                  {dayTasks.length === 0 ? (
                    <div className="h-28 flex flex-col items-center justify-center text-center p-2">
                      <p className="text-xs text-slate-400 font-medium">
                        Sem tarefas
                      </p>
                    </div>
                  ) : (
                    dayTasks.map((t) => (
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

                          {/* Time badge if present */}
                          {t.time && (
                            <span className="inline-flex items-center gap-1 mt-1 text-[10px] text-slate-500 font-medium">
                              <Clock className="w-2.5 h-2.5 text-indigo-400" />
                              {t.time}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Inline Quick Add Input at Column Bottom */}
                <div className="mt-3 pt-2.5 border-t border-slate-200/40">
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
                      className="w-full text-xs bg-white/70 hover:bg-white focus:bg-white border border-slate-200/60 rounded-xl pl-3 pr-8 py-2 text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
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
