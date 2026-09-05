"use client";

import { useState, useTransition, useMemo, useRef, useEffect, useCallback, useSyncExternalStore } from "react";
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
  getTaskByIdAction,
  moveOrReorderTasksAction,
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
  CornerDownRight,
  ListTree,
  GripVertical,
} from "lucide-react";

// Client-side today subscription for zero SSR hydration mismatch
let cachedToday = "";
function getClientToday(): string {
  const current = toDateString(new Date());
  if (current !== cachedToday) {
    cachedToday = current;
  }
  return cachedToday;
}
function getServerToday(): string {
  return "";
}
function subscribeToday(callback: () => void) {
  window.addEventListener("focus", callback);
  const timer = setInterval(callback, 60000);
  return () => {
    window.removeEventListener("focus", callback);
    clearInterval(timer);
  };
}

function useTodayDateStr(): string {
  return useSyncExternalStore(subscribeToday, getClientToday, getServerToday);
}

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

  // Drag and Drop states
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    dateStr: string;
    targetTaskId?: string;
    position: "before" | "after" | "nest" | "column";
  } | null>(null);
  const isDragCooldownRef = useRef(false);
  const dragCooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerDragCooldown = useCallback(() => {
    isDragCooldownRef.current = true;
    if (dragCooldownTimerRef.current) {
      clearTimeout(dragCooldownTimerRef.current);
    }
    dragCooldownTimerRef.current = setTimeout(() => {
      isDragCooldownRef.current = false;
    }, 180);
  }, []);

  useEffect(() => {
    return () => {
      if (dragCooldownTimerRef.current) {
        clearTimeout(dragCooldownTimerRef.current);
      }
    };
  }, []);

  const draggedTask = useMemo(
    () => (draggedTaskId ? tasks.find((t) => t.id === draggedTaskId) || null : null),
    [tasks, draggedTaskId]
  );

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

  // Client-side today date string from synchronized store (returns "" on server, todayStr on client)
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

  // Save client timezone in cookie and synchronize week boundary if client timezone differs from server
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) {
        document.cookie = `user_tz=${encodeURIComponent(tz)}; path=/; max-age=31536000; SameSite=Lax`;
      }
    } catch {
      // Ignore if Intl is unavailable
    }

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

  // Calculate the 7 days of current week (using todayStr to ensure SSR matches initial client hydration)
  const weekDays = useMemo(
    () => getWeekDays(currentMonday, todayStr),
    [currentMonday, todayStr]
  );

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

    // Ordenar tarefas de cada dia pelo campo order ascendente, com fallback para createdAt
    Object.keys(map).forEach((dateKey) => {
      map[dateKey].sort((a, b) => {
        const orderDiff = (a.order ?? 0) - (b.order ?? 0);
        if (orderDiff !== 0) return orderDiff;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
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
      parentId: null,
      parent: null,
      tag: null,
      title,
      content: "",
      date: dateStr,
      time: null,
      duration: null,
      completed: false,
      order: tasks.filter((t) => t.date === dateStr && !t.parentId).length,
      createdAt: new Date(),
      updatedAt: new Date(),
      subtaskCount: 0,
      completedSubtaskCount: 0,
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

  // Open modal (supports passing TaskWithTag directly or taskId string for deep links)
  const handleOpenTask = async (taskOrId: TaskWithTag | string) => {
    // Ignora cliques residuais imediatos durante o cooldown de drop (180ms)
    if (isDragCooldownRef.current) return;

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

  // Drag and Drop Event Handlers
  const handleDragStart = (e: React.DragEvent, task: TaskWithTag) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", task.id);
    requestAnimationFrame(() => {
      setDraggedTaskId(task.id);
    });
  };

  const handleDragEnd = () => {
    triggerDragCooldown();
    setDraggedTaskId(null);
    setDropTarget(null);
  };

  const handleCardDragOver = (
    e: React.DragEvent,
    targetTask: TaskWithTag,
    dateStr: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";

    if (!draggedTaskId || draggedTaskId === targetTask.id) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const ratio = offsetY / rect.height;

    const dragged = tasks.find((t) => t.id === draggedTaskId);
    const draggedHasSubs = Boolean(
      (dragged?.subtaskCount && dragged.subtaskCount > 0) ||
        tasks.some((t) => t.parentId === draggedTaskId)
    );

    // Permite aninhar apenas se o alvo for tarefa principal (sem parentId) e o item arrastado não tiver subtarefas
    const canNest = !targetTask.parentId && !draggedHasSubs;

    let position: "before" | "after" | "nest";
    if (canNest && ratio >= 0.28 && ratio <= 0.72) {
      position = "nest";
    } else if (ratio < 0.5) {
      position = "before";
    } else {
      position = "after";
    }

    if (
      !dropTarget ||
      dropTarget.targetTaskId !== targetTask.id ||
      dropTarget.position !== position ||
      dropTarget.dateStr !== dateStr
    ) {
      setDropTarget({
        dateStr,
        targetTaskId: targetTask.id,
        position,
      });
    }
  };

  const handleColumnDragOver = (e: React.DragEvent, dateStr: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    if (!draggedTaskId) return;

    if (
      !dropTarget ||
      dropTarget.targetTaskId !== undefined ||
      dropTarget.dateStr !== dateStr
    ) {
      setDropTarget({
        dateStr,
        position: "column",
      });
    }
  };

  const handleColumnDragLeave = (e: React.DragEvent, dateStr: string) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      if (dropTarget?.dateStr === dateStr && dropTarget.position === "column") {
        setDropTarget(null);
      }
    }
  };

  const handleDrop = async (
    e: React.DragEvent,
    dateStr: string,
    onTargetTask?: TaskWithTag
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const currentDrop = dropTarget;
    const currentDraggedId = draggedTaskId;
    triggerDragCooldown();
    setDropTarget(null);
    setDraggedTaskId(null);

    if (!currentDraggedId) return;

    const dragged = tasks.find((t) => t.id === currentDraggedId);
    if (!dragged) return;

    const targetId = currentDrop?.targetTaskId || onTargetTask?.id;
    if (targetId && targetId === currentDraggedId) return;

    const originalDate = dragged.date;
    const originalParentId = dragged.parentId;
    const targetTask = targetId ? tasks.find((t) => t.id === targetId) : null;
    const targetPosition = currentDrop?.position || "column";

    // Snapshot para rollback seguro em caso de falha de rede
    const previousTasks = [...tasks];

    // Determinar nova data e novo pai
    let newDate = dateStr;
    let newParentId: string | null = null;
    let newParentObj: { id: string; title: string } | null = null;

    const sameDaySubtasks = tasks.filter(
      (t) => t.parentId === currentDraggedId && t.date === originalDate
    );
    const draggedHasSubs =
      Boolean(dragged.subtaskCount && dragged.subtaskCount > 0) ||
      sameDaySubtasks.length > 0;

    if (targetPosition === "nest" && targetTask) {
      // Aninhar dentro de uma tarefa principal
      if (targetTask.parentId || draggedHasSubs) return;
      newParentId = targetTask.id;
      newParentObj = { id: targetTask.id, title: targetTask.title };
      newDate = targetTask.date;
    } else if (
      (targetPosition === "before" || targetPosition === "after") &&
      targetTask
    ) {
      newDate = targetTask.date;
      if (targetTask.parentId) {
        // Alvo é subtarefa -> arrastado vira subtarefa sob o mesmo pai se permitido
        if (!draggedHasSubs) {
          newParentId = targetTask.parentId;
          newParentObj = targetTask.parent || null;
        } else {
          newParentId = null;
          newParentObj = null;
        }
      } else {
        // Alvo é tarefa principal -> arrastado vira tarefa independente
        newParentId = null;
        newParentObj = null;
      }
    } else {
      // Solto no espaço da coluna
      newDate = dateStr;
      newParentId = null;
      newParentObj = null;
    }

    // Regra do usuário: se a tarefa for arrastada para outro dia e contiver subtarefas no mesmo dia, todas vão para o novo dia
    const movingParentToNewDate =
      !newParentId && originalDate !== newDate && sameDaySubtasks.length > 0;

    // Calcular IDs ordenados no container de destino
    let targetOrderedIds: string[] = [];

    if (newParentId) {
      const currentSubs = tasks
        .filter((t) => t.parentId === newParentId && t.id !== currentDraggedId)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

      if (targetTask && targetTask.parentId === newParentId) {
        const targetIdx = currentSubs.findIndex((t) => t.id === targetTask.id);
        const insertIdx =
          targetPosition === "before" ? targetIdx : targetIdx + 1;
        currentSubs.splice(insertIdx, 0, dragged);
      } else {
        currentSubs.push(dragged);
      }
      targetOrderedIds = currentSubs.map((t) => t.id);
    } else {
      const currentMains = tasks
        .filter(
          (t) =>
            !t.parentId &&
            t.date === newDate &&
            t.id !== currentDraggedId
        )
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

      if (targetTask && !targetTask.parentId && targetTask.date === newDate) {
        const targetIdx = currentMains.findIndex((t) => t.id === targetTask.id);
        const insertIdx =
          targetPosition === "before" ? targetIdx : targetIdx + 1;
        currentMains.splice(insertIdx, 0, dragged);
      } else {
        currentMains.push(dragged);
      }
      targetOrderedIds = currentMains.map((t) => t.id);
    }

    // Calcular IDs ordenados no container de origem caso a data ou pai tenham mudado
    let sourceOrderedIds: string[] = [];
    if (originalDate !== newDate || originalParentId !== newParentId) {
      if (!originalParentId) {
        sourceOrderedIds = tasks
          .filter(
            (t) =>
              !t.parentId &&
              t.date === originalDate &&
              t.id !== currentDraggedId
          )
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .map((t) => t.id);
      } else {
        sourceOrderedIds = tasks
          .filter(
            (t) =>
              t.parentId === originalParentId &&
              t.id !== currentDraggedId
          )
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .map((t) => t.id);
      }
    }

    // Atualização otimista e fluida da UI
    setTasks((prev) => {
      return prev.map((t) => {
        if (t.id === currentDraggedId) {
          const newOrderIdx = targetOrderedIds.indexOf(t.id);
          return {
            ...t,
            date: newDate,
            parentId: newParentId,
            parent: newParentObj,
            order: newOrderIdx !== -1 ? newOrderIdx : (t.order ?? 0),
          };
        }

        // Subtarefas do mesmo dia que acompanham o pai para o novo dia
        if (
          movingParentToNewDate &&
          t.parentId === currentDraggedId &&
          t.date === originalDate
        ) {
          return {
            ...t,
            date: newDate,
          };
        }

        const targetIdx = targetOrderedIds.indexOf(t.id);
        if (targetIdx !== -1) {
          return { ...t, order: targetIdx };
        }

        const sourceIdx = sourceOrderedIds.indexOf(t.id);
        if (sourceIdx !== -1) {
          return { ...t, order: sourceIdx };
        }

        // Atualizar contadores do pai anterior se mudou
        if (
          originalParentId &&
          originalParentId !== newParentId &&
          t.id === originalParentId
        ) {
          return {
            ...t,
            subtaskCount: Math.max(0, (t.subtaskCount || 1) - 1),
            completedSubtaskCount: dragged.completed
              ? Math.max(0, (t.completedSubtaskCount || 1) - 1)
              : t.completedSubtaskCount,
          };
        }

        // Atualizar contadores do novo pai se mudou
        if (
          newParentId &&
          newParentId !== originalParentId &&
          t.id === newParentId
        ) {
          return {
            ...t,
            subtaskCount: (t.subtaskCount || 0) + 1,
            completedSubtaskCount: dragged.completed
              ? (t.completedSubtaskCount || 0) + 1
              : t.completedSubtaskCount,
          };
        }

        return t;
      });
    });

    // Sincronizar com o banco via Server Action em background
    try {
      const res = await moveOrReorderTasksAction({
        taskId: currentDraggedId,
        targetDate: newDate,
        targetParentId: newParentId,
        targetOrderedIds,
        sourceOrderedIds,
        originalDate,
        moveSameDaySubtasks: movingParentToNewDate,
      });

      if (res?.error) {
        console.error("Erro ao sincronizar ordenação:", res.error);
        setTasks(previousTasks);
      }
    } catch (err) {
      console.error("Erro de rede ao sincronizar drag and drop:", err);
      setTasks(previousTasks);
    }
  };

  // When a subtask is created inside modal
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

  // Modal updates
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
                onDragOver={(e) => handleColumnDragOver(e, day.dateStr)}
                onDragLeave={(e) => handleColumnDragLeave(e, day.dateStr)}
                onDrop={(e) => handleDrop(e, day.dateStr)}
                className={`rounded-2xl flex flex-col min-h-[480px] p-3.5 transition-all duration-200 ${
                  dropTarget?.dateStr === day.dateStr &&
                  (dropTarget.position === "column" || !dropTarget.targetTaskId)
                    ? "ring-2 ring-indigo-400/50 bg-indigo-50/25"
                    : day.isToday
                    ? "glass-card-today ring-1 ring-indigo-500/20"
                    : "glass-card"
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
                  {(() => {
                    // 1. Top-level tasks on this day (no parentId)
                    const mainTasks = dayTasks.filter((t) => !t.parentId);

                    // 2. Subtasks on this day whose parent is on a different day or not in dayTasks
                    const diffDaySubtasks = dayTasks.filter(
                      (t) => t.parentId && !dayTasks.some((p) => p.id === t.parentId)
                    );

                    // Helper to render an individual task card
                    const renderTaskCard = (
                      t: TaskWithTag,
                      isSameDaySubtask = false,
                      isDiffDaySubtask = false
                    ) => {
                      const tagStyles = t.tag ? getTagColorStyles(t.tag.color) : null;
                      const isDragging = draggedTaskId === t.id;
                      const isTarget = dropTarget?.targetTaskId === t.id;
                      const isNestTarget = isTarget && dropTarget?.position === "nest";
                      const isBeforeTarget = isTarget && dropTarget?.position === "before";
                      const isAfterTarget = isTarget && dropTarget?.position === "after";

                      // Se o pai desta subtarefa estiver sendo arrastado, destaca que a subtarefa o acompanha
                      const isAttachedToDragged = Boolean(
                        draggedTaskId &&
                          t.parentId === draggedTaskId &&
                          draggedTask &&
                          t.date === draggedTask.date
                      );

                      return (
                        <div
                          key={t.id}
                          draggable={true}
                          onDragStart={(e) => handleDragStart(e, t)}
                          onDragEnd={handleDragEnd}
                          onDragOver={(e) => handleCardDragOver(e, t, t.date)}
                          onDrop={(e) => handleDrop(e, t.date, t)}
                          onClick={() => handleOpenTask(t)}
                          className={`group relative flex items-start gap-2 p-2.5 rounded-xl border transition-all select-none cursor-pointer ${
                            isDragging
                              ? "opacity-35 scale-[0.98] border-dashed border-indigo-400 bg-indigo-50/20 shadow-none cursor-grabbing"
                              : isNestTarget
                              ? "ring-2 ring-indigo-500 bg-indigo-50/85 border-indigo-400 shadow-md cursor-grabbing"
                              : isAttachedToDragged
                              ? "opacity-60 border-dashed border-indigo-300 bg-indigo-50/10"
                              : t.completed
                              ? "bg-slate-50/50 border-slate-200/40 text-slate-400"
                              : isSameDaySubtask
                              ? "bg-white/95 hover:bg-white border-slate-200/70 text-slate-800 hover:shadow-xs hover:border-indigo-300"
                              : "bg-white/85 hover:bg-white border-slate-200/60 text-slate-800 hover:shadow-xs hover:border-indigo-200"
                          }`}
                        >
                          {/* Drop Indicator Line: Before */}
                          {isBeforeTarget && (
                            <div className="absolute -top-1.5 left-0 right-0 h-0.5 bg-indigo-600 rounded-full z-30 pointer-events-none flex items-center">
                              <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 -ml-1 ring-2 ring-white shadow-xs" />
                            </div>
                          )}

                          {/* Drop Indicator Line: After */}
                          {isAfterTarget && (
                            <div className="absolute -bottom-1.5 left-0 right-0 h-0.5 bg-indigo-600 rounded-full z-30 pointer-events-none flex items-center">
                              <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 -ml-1 ring-2 ring-white shadow-xs" />
                            </div>
                          )}

                          {/* Drag Grip Handle */}
                          <div
                            className="mt-0.5 text-slate-300 group-hover:text-slate-500 transition-colors flex-shrink-0 cursor-grab active:cursor-grabbing"
                            title="Arraste para mover ou reordenar"
                          >
                            <GripVertical className="w-3.5 h-3.5" />
                          </div>

                          {/* Checkbox */}
                          <button
                            type="button"
                            draggable={false}
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
                          <div className={`flex-1 min-w-0 ${draggedTaskId ? "pointer-events-none" : ""}`}>
                            {/* Diff day indicator (parent pill) */}
                            {isDiffDaySubtask && t.parent && (
                              <div className="flex items-center gap-1 mb-1">
                                <span
                                  className="inline-flex items-center gap-1 text-[10px] font-medium text-indigo-600 bg-indigo-50/90 border border-indigo-100 px-1.5 py-0.5 rounded-md max-w-[170px] truncate"
                                  title={`Subtarefa de: ${t.parent.title}`}
                                >
                                  <CornerDownRight className="w-2.5 h-2.5 text-indigo-500 flex-shrink-0" />
                                  <span className="truncate">{t.parent.title}</span>
                                </span>
                              </div>
                            )}

                            <p
                              className={`text-xs font-medium leading-snug break-words ${
                                t.completed
                                  ? "line-through text-slate-400"
                                  : "text-slate-700"
                              }`}
                            >
                              {t.title}
                            </p>

                            {/* Nest Target Indicator Pill */}
                            {isNestTarget && (
                              <div className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-indigo-700 bg-indigo-100/90 px-1.5 py-0.5 rounded-md animate-pulse">
                                <CornerDownRight className="w-2.5 h-2.5 text-indigo-600 flex-shrink-0" />
                                <span>Soltar para virar subtarefa</span>
                              </div>
                            )}

                            {/* Tag, Time, Duration & Subtask Progress Badges row */}
                            {Boolean(
                              t.tag ||
                                t.time ||
                                (t.duration != null && t.duration > 0) ||
                                (t.subtaskCount != null && t.subtaskCount > 0)
                            ) && (
                              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                {/* Subtask progress count badge for main tasks */}
                                {Boolean(
                                  t.subtaskCount != null && t.subtaskCount > 0
                                ) && (
                                  <span
                                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium border shadow-2xs ${
                                      t.completed ||
                                      t.completedSubtaskCount === t.subtaskCount
                                        ? "bg-slate-100/80 text-slate-400 border-slate-200/50"
                                        : "bg-indigo-50/90 text-indigo-700 border-indigo-200/60"
                                    }`}
                                    title={`Subtarefas: ${
                                      t.completedSubtaskCount || 0
                                    } de ${t.subtaskCount} concluídas`}
                                  >
                                    <ListTree
                                      className={`w-2.5 h-2.5 ${
                                        t.completed
                                          ? "text-slate-400"
                                          : "text-indigo-500"
                                      }`}
                                    />
                                    <span>
                                      {t.completedSubtaskCount || 0}/
                                      {t.subtaskCount}
                                    </span>
                                  </span>
                                )}

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
                                        t.completed
                                          ? "bg-slate-400"
                                          : tagStyles.dotClass
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
                                {Boolean(t.duration != null && t.duration > 0) && (
                                  <span
                                    className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md border shadow-2xs ${
                                      t.completed
                                        ? "bg-slate-100/80 text-slate-400 border-slate-200/50"
                                        : "bg-amber-50/90 text-amber-700 border-amber-200/60"
                                    }`}
                                    title={`Duração estimada: ${formatDuration(
                                      t.duration!
                                    )}`}
                                  >
                                    <Timer
                                      className={`w-2.5 h-2.5 ${
                                        t.completed
                                          ? "text-slate-400"
                                          : "text-amber-500"
                                      }`}
                                    />
                                    {formatDuration(t.duration!)}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    };

                    return (
                      <>
                        {/* Render main tasks and their same-day subtasks immediately below with indentation & guide line */}
                        {mainTasks.map((mainTask) => {
                          const sameDaySubtasks = dayTasks.filter(
                            (sub) => sub.parentId === mainTask.id
                          );

                          return (
                            <div key={mainTask.id} className="space-y-1.5">
                              {renderTaskCard(mainTask)}

                              {/* Same day subtasks nested with left indent and connector guide line */}
                              {sameDaySubtasks.length > 0 && (
                                <div className="ml-5 pl-2.5 border-l-2 border-indigo-200/60 space-y-1.5 my-1">
                                  {sameDaySubtasks.map((sub) =>
                                    renderTaskCard(sub, true, false)
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Render subtasks scheduled on this day whose parent is on a different day */}
                        {diffDaySubtasks.map((sub) => (
                          <div key={sub.id}>
                            {renderTaskCard(sub, false, true)}
                          </div>
                        ))}
                      </>
                    );
                  })()}

                  {/* Drop zone dedicada exibida na coluna durante arraste */}
                  {draggedTaskId && (
                    <div
                      onDragOver={(e) => handleColumnDragOver(e, day.dateStr)}
                      onDrop={(e) => handleDrop(e, day.dateStr)}
                      className={`h-10 border-2 border-dashed rounded-xl flex items-center justify-center text-[11px] font-medium transition-all ${
                        dropTarget?.dateStr === day.dateStr &&
                        (dropTarget.position === "column" || !dropTarget.targetTaskId)
                          ? "border-indigo-400 bg-indigo-50/70 text-indigo-700 shadow-xs"
                          : "border-slate-200/60 text-slate-400 hover:border-indigo-300 hover:text-indigo-500 bg-white/20"
                      }`}
                    >
                      <span>Mover para {day.dayNameShort}</span>
                    </div>
                  )}

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
                      {Boolean((newTitles[day.dateStr] || "").trim()) && (
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
        onOpenTask={handleOpenTask}
        onSubtaskCreated={handleSubtaskCreated}
      />
    </div>
  );
}

