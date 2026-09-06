"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { TaskWithTag } from "@/db/schema";
import { moveOrReorderTasksAction } from "@/app/actions/tasks";

export interface DropTargetState {
  dateStr: string;
  targetTaskId?: string;
  position: "before" | "after" | "nest" | "column";
}

interface UseBoardDnDProps {
  tasks: TaskWithTag[];
  setTasks: React.Dispatch<React.SetStateAction<TaskWithTag[]>>;
}

export function useBoardDnD({ tasks, setTasks }: UseBoardDnDProps) {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTargetState | null>(null);

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
    dateStr?: string | null
  ) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";

    if (!draggedTaskId || draggedTaskId === targetTask.id) return;

    const effectiveDateStr = dateStr || "unscheduled";
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
      dropTarget.dateStr !== effectiveDateStr
    ) {
      setDropTarget({
        dateStr: effectiveDateStr,
        targetTaskId: targetTask.id,
        position,
      });
    }
  };

  const handleColumnDragOver = (e: React.DragEvent, dateStr?: string | null) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    if (!draggedTaskId) return;

    const effectiveDateStr = dateStr || "unscheduled";

    if (
      !dropTarget ||
      dropTarget.targetTaskId !== undefined ||
      dropTarget.dateStr !== effectiveDateStr
    ) {
      setDropTarget({
        dateStr: effectiveDateStr,
        position: "column",
      });
    }
  };

  const handleColumnDragLeave = (e: React.DragEvent, dateStr?: string | null) => {
    e.preventDefault();
    const effectiveDateStr = dateStr || "unscheduled";
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      if (dropTarget?.dateStr === effectiveDateStr && dropTarget.position === "column") {
        setDropTarget(null);
      }
    }
  };

  const handleDrop = async (
    e: React.DragEvent,
    dateStr?: string | null,
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
    const incomingResolvedDate = (!dateStr || dateStr === "unscheduled") ? null : dateStr;
    let newDate: string | null = incomingResolvedDate;
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
      newDate = targetTask.date || null;
    } else if (
      (targetPosition === "before" || targetPosition === "after") &&
      targetTask
    ) {
      newDate = targetTask.date || null;
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
      newDate = incomingResolvedDate;
      newParentId = null;
      newParentObj = null;
    }

    // Regra do usuário: se a tarefa for arrastada para outro dia e contiver subtarefas no mesmo dia, todas vão para o novo dia
    const movingParentToNewDate =
      !newParentId && originalDate !== newDate && Boolean(originalDate && newDate && sameDaySubtasks.length > 0);

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
            (newDate ? t.date === newDate : !t.date) &&
            t.id !== currentDraggedId
        )
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

      if (
        targetTask &&
        !targetTask.parentId &&
        ((newDate && targetTask.date === newDate) || (!newDate && !targetTask.date))
      ) {
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
              (originalDate ? t.date === originalDate : !t.date) &&
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

  return {
    draggedTaskId,
    draggedTask,
    dropTarget,
    isDragCooldownRef,
    handleDragStart,
    handleDragEnd,
    handleCardDragOver,
    handleColumnDragOver,
    handleColumnDragLeave,
    handleDrop,
  };
}
