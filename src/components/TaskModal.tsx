"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Task } from "@/db/schema";
import { updateTaskAction, deleteTaskAction } from "@/app/actions/tasks";
import {
  X,
  Trash2,
  Calendar,
  Clock,
  CheckCircle2,
  Circle,
  Loader2,
  Check,
  AlertTriangle,
} from "lucide-react";

interface TaskModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onTaskUpdated: (updatedTask: Task) => void;
  onTaskDeleted: (taskId: string) => void;
}

interface TaskModalDialogProps {
  task: Task;
  onClose: () => void;
  onTaskUpdated: (updatedTask: Task) => void;
  onTaskDeleted: (taskId: string) => void;
}

function TaskModalDialog({
  task,
  onClose,
  onTaskUpdated,
  onTaskDeleted,
}: TaskModalDialogProps) {
  const [title, setTitle] = useState(task.title);
  const [content, setContent] = useState(task.content || "");
  const [date, setDate] = useState(task.date);
  const [time, setTime] = useState(task.time || "");
  const [completed, setCompleted] = useState(task.completed);

  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, startDeleteTransition] = useTransition();

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-resize textarea according to content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.max(
        textareaRef.current.scrollHeight,
        140
      )}px`;
    }
  }, [content]);

  // Handle escape key to close modal
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Debounced auto-save function
  const triggerAutoSave = (updates: {
    title?: string;
    content?: string;
    date?: string;
    time?: string | null;
  }) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    setIsSaving(true);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const res = await updateTaskAction(task.id, updates);
        if (res.task) {
          onTaskUpdated(res.task);
          setLastSavedTime(new Date());
        }
      } catch (err) {
        console.error("Falha no auto-save:", err);
      } finally {
        setIsSaving(false);
      }
    }, 600);
  };

  const handleTitleChange = (val: string) => {
    setTitle(val);
    triggerAutoSave({ title: val });
  };

  const handleContentChange = (val: string) => {
    setContent(val);
    triggerAutoSave({ content: val });
  };

  const handleDateChange = (val: string) => {
    setDate(val);
    triggerAutoSave({ date: val });
  };

  const handleTimeChange = (val: string) => {
    setTime(val);
    triggerAutoSave({ time: val || null });
  };

  const handleToggleCompleted = async () => {
    const newCompleted = !completed;
    setCompleted(newCompleted);
    try {
      const res = await updateTaskAction(task.id, {});
      if (res.task) {
        const updated = { ...res.task, completed: newCompleted };
        onTaskUpdated(updated);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = () => {
    startDeleteTransition(async () => {
      const res = await deleteTaskAction(task.id);
      if (res.success) {
        onTaskDeleted(task.id);
        onClose();
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog Card */}
      <div className="relative w-full max-w-xl glass-panel rounded-3xl shadow-2xl p-6 sm:p-8 flex flex-col max-h-[90vh] overflow-hidden z-10 border border-white/80">
        {/* Header Bar */}
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200/50">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            {isSaving ? (
              <span className="flex items-center gap-1.5 text-indigo-600 font-medium">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Salvando...
              </span>
            ) : lastSavedTime ? (
              <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
                <Check className="w-3.5 h-3.5" />
                Salvo automaticamente
              </span>
            ) : (
              <span className="text-slate-400">Edição com salvamento automático</span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition-colors cursor-pointer"
              title="Fechar (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto py-5 space-y-5 pr-1">
          {/* Title and Complete Button */}
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={handleToggleCompleted}
              className="mt-1 text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer flex-shrink-0"
              title={completed ? "Marcar como pendente" : "Marcar como concluída"}
            >
              {completed ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              ) : (
                <Circle className="w-6 h-6 text-slate-400 hover:text-indigo-500" />
              )}
            </button>

            <input
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Título da tarefa..."
              className={`w-full text-lg sm:text-xl font-semibold bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none transition-colors px-1 py-0.5 text-slate-800 ${
                completed ? "line-through text-slate-400" : ""
              }`}
            />
          </div>

          {/* Date & Time Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50/70 rounded-2xl border border-slate-200/60">
            {/* Date Picker */}
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                Dia da Tarefa
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => handleDateChange(e.target.value)}
                className="w-full text-sm bg-white/80 border border-slate-200/80 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            {/* Time Picker */}
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-500" />
                Horário (Opcional)
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => handleTimeChange(e.target.value)}
                className="w-full text-sm bg-white/80 border border-slate-200/80 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Notes / Content Textarea (Auto-Resize) */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Observações & Detalhes
            </label>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              placeholder="Escreva anotações, subtarefas ou observações sobre esta tarefa... (salvo automaticamente)"
              className="w-full p-4 rounded-2xl bg-white/80 border border-slate-200/80 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none transition-all leading-relaxed"
            />
          </div>
        </div>

        {/* Footer Bar with Delete Button */}
        <div className="pt-4 mt-2 border-t border-slate-200/50 flex items-center justify-between">
          {!showDeleteConfirm ? (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-rose-500 hover:text-rose-700 hover:bg-rose-50/80 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              Excluir tarefa
            </button>
          ) : (
            <div className="flex items-center gap-2 bg-rose-50/90 border border-rose-200 p-2 rounded-xl text-xs sm:text-sm">
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span className="text-rose-700 font-medium">Excluir tarefa?</span>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDelete}
                className="px-2.5 py-1 bg-rose-600 text-white rounded-lg font-medium hover:bg-rose-700 transition-colors disabled:opacity-50 cursor-pointer text-xs"
              >
                {isDeleting ? "Excluindo..." : "Confirmar"}
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-2 py-1 text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer text-xs"
              >
                Cancelar
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200/80 text-slate-700 font-medium text-xs sm:text-sm rounded-xl transition-colors cursor-pointer"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
}

export function TaskModal({
  task,
  isOpen,
  onClose,
  onTaskUpdated,
  onTaskDeleted,
}: TaskModalProps) {
  if (!isOpen || !task) return null;

  return (
    <TaskModalDialog
      key={task.id}
      task={task}
      onClose={onClose}
      onTaskUpdated={onTaskUpdated}
      onTaskDeleted={onTaskDeleted}
    />
  );
}
