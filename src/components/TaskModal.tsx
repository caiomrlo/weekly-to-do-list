"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { TaskWithTag, Tag } from "@/db/schema";
import {
  updateTaskAction,
  deleteTaskAction,
  createTaskAction,
  getSubtasksAction,
  toggleTaskStatusAction,
} from "@/app/actions/tasks";
import { getUserTagsAction, createTagAction } from "@/app/actions/tags";
import { TAG_COLORS, getTagColorStyles } from "@/lib/tag-utils";
import {
  formatDuration,
  parseNaturalDuration,
} from "@/lib/date-utils";
import { TaskDescriptionEditor } from "./TaskDescriptionEditor";
import {
  X,
  Trash2,
  Calendar,
  Clock,
  Timer,
  CheckCircle2,
  Circle,
  Loader2,
  Check,
  AlertTriangle,
  Tag as TagIcon,
  Plus,
  ChevronDown,
  CornerDownRight,
  ListTree,
  ArrowRight,
  ExternalLink,
} from "lucide-react";

interface TaskModalProps {
  task: TaskWithTag | null;
  isOpen: boolean;
  onClose: () => void;
  onTaskUpdated: (updatedTask: TaskWithTag) => void;
  onTaskDeleted: (taskId: string) => void;
  onOpenTask?: (task: TaskWithTag | string) => void;
  onSubtaskCreated?: (subtask: TaskWithTag) => void;
}

interface TaskModalDialogProps {
  task: TaskWithTag;
  onClose: () => void;
  onTaskUpdated: (updatedTask: TaskWithTag) => void;
  onTaskDeleted: (taskId: string) => void;
  onOpenTask?: (task: TaskWithTag | string) => void;
  onSubtaskCreated?: (subtask: TaskWithTag) => void;
}

function TaskModalDialog({
  task,
  onClose,
  onTaskUpdated,
  onTaskDeleted,
  onOpenTask,
  onSubtaskCreated,
}: TaskModalDialogProps) {
  const [title, setTitle] = useState(task.title);
  const [content, setContent] = useState(task.content || "");
  const [date, setDate] = useState<string>(task.date || "");
  const [time, setTime] = useState(task.time || "");
  const [duration, setDuration] = useState<number | null>(task.duration ?? null);
  const [durationText, setDurationText] = useState<string>(
    task.duration ? formatDuration(task.duration) : ""
  );
  const [completed, setCompleted] = useState(task.completed);
  const [selectedTag, setSelectedTag] = useState<Tag | null>(task.tag || null);

  // Subtasks state
  const [subtasks, setSubtasks] = useState<TaskWithTag[]>([]);
  const [isLoadingSubtasks, setIsLoadingSubtasks] = useState(!task.parentId);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);

  // Tags list & creation state
  const [userTags, setUserTags] = useState<Tag[]>([]);
  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("indigo");
  const [isCreatingTagLoading, setIsCreatingTagLoading] = useState(false);
  const [tagError, setTagError] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, startDeleteTransition] = useTransition();

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const tagDropdownRef = useRef<HTMLDivElement>(null);

  // Fetch subtasks if task is a main task
  useEffect(() => {
    let isMounted = true;
    if (!task.parentId) {
      getSubtasksAction(task.id).then((res) => {
        if (isMounted) {
          if (res.subtasks) {
            setSubtasks(res.subtasks);
          }
          setIsLoadingSubtasks(false);
        }
      });
    }
    return () => {
      isMounted = false;
    };
  }, [task.id, task.parentId]);

  // Fetch available user tags on load
  useEffect(() => {
    async function loadTags() {
      const res = await getUserTagsAction();
      if (res.tags) {
        setUserTags(res.tags);
      }
    }
    loadTags();
  }, []);

  // Close tag dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        tagDropdownRef.current &&
        !tagDropdownRef.current.contains(e.target as Node)
      ) {
        setIsTagDropdownOpen(false);
        setIsCreatingTag(false);
        setTagError("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle escape key to close modal
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (isTagDropdownOpen) {
          setIsTagDropdownOpen(false);
          setIsCreatingTag(false);
        } else {
          onClose();
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, isTagDropdownOpen]);

  // Debounced auto-save function
  const triggerAutoSave = (updates: {
    title?: string;
    content?: string;
    date?: string | null;
    time?: string | null;
    duration?: number | null;
    tagId?: string | null;
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
    const formatted = val.trim() || null;
    setDate(formatted || "");
    triggerAutoSave({ date: formatted });
    onTaskUpdated({ ...task, date: formatted });
  };

  const handleTimeChange = (val: string) => {
    setTime(val);
    triggerAutoSave({ time: val || null });
  };

  const handleDurationInputChange = (val: string) => {
    setDurationText(val);
    const parsed = parseNaturalDuration(val);
    if (val.trim() === "") {
      setDuration(null);
      triggerAutoSave({ duration: null });
    } else if (parsed !== null) {
      setDuration(parsed);
      triggerAutoSave({ duration: parsed });
    }
  };

  const handleDurationBlur = () => {
    if (duration) {
      setDurationText(formatDuration(duration));
    } else if (durationText.trim() !== "") {
      const parsed = parseNaturalDuration(durationText);
      if (parsed) {
        setDuration(parsed);
        setDurationText(formatDuration(parsed));
        triggerAutoSave({ duration: parsed });
      } else {
        setDurationText("");
        setDuration(null);
        triggerAutoSave({ duration: null });
      }
    }
  };

  const handleClearDuration = () => {
    setDurationText("");
    setDuration(null);
    triggerAutoSave({ duration: null });
  };

  const handleSelectTag = (tag: Tag | null) => {
    setSelectedTag(tag);
    setIsTagDropdownOpen(false);
    setIsCreatingTag(false);
    triggerAutoSave({ tagId: tag ? tag.id : null });
  };

  const handleCreateNewTag = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTagName.trim();
    if (!trimmed) {
      setTagError("O nome da tag é obrigatório.");
      return;
    }

    setIsCreatingTagLoading(true);
    setTagError("");

    try {
      const res = await createTagAction({
        name: trimmed,
        color: newTagColor,
      });

      if (res.tag) {
        setUserTags((prev) => [...prev, res.tag!]);
        setSelectedTag(res.tag);
        setNewTagName("");
        setIsCreatingTag(false);
        setIsTagDropdownOpen(false);
        triggerAutoSave({ tagId: res.tag.id });
      } else if (res.error) {
        setTagError(res.error);
      }
    } catch (err) {
      console.error(err);
      setTagError("Erro ao criar a tag.");
    } finally {
      setIsCreatingTagLoading(false);
    }
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

  const handleCreateSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newSubtaskTitle.trim();
    if (!trimmed || isAddingSubtask) return;

    setIsAddingSubtask(true);
    setNewSubtaskTitle("");

    try {
      const res = await createTaskAction({
        title: trimmed,
        date: date ? date : null,
        parentId: task.id,
      });

      if (res.task) {
        const created = res.task;
        setSubtasks((prev) => [...prev, created]);
        const nextTotal = subtasks.length + 1;
        const nextCompleted = subtasks.filter((s) => s.completed).length;
        onTaskUpdated({
          ...task,
          subtaskCount: nextTotal,
          completedSubtaskCount: nextCompleted,
        });
        onSubtaskCreated?.(created);
      }
    } catch (err) {
      console.error("Erro ao criar subtarefa:", err);
    } finally {
      setIsAddingSubtask(false);
    }
  };

  const handleToggleSubtask = async (sub: TaskWithTag) => {
    const nextCompleted = !sub.completed;
    const updatedSub = { ...sub, completed: nextCompleted };
    setSubtasks((prev) =>
      prev.map((s) => (s.id === sub.id ? updatedSub : s))
    );

    const updatedSubtasks = subtasks.map((s) =>
      s.id === sub.id ? updatedSub : s
    );
    const nextCompletedCount = updatedSubtasks.filter((s) => s.completed).length;

    onTaskUpdated({
      ...task,
      subtaskCount: updatedSubtasks.length,
      completedSubtaskCount: nextCompletedCount,
    });
    onTaskUpdated(updatedSub);

    await toggleTaskStatusAction(sub.id, nextCompleted);
  };

  const handleDeleteSubtask = async (subId: string) => {
    const remaining = subtasks.filter((s) => s.id !== subId);
    setSubtasks(remaining);
    const nextCompletedCount = remaining.filter((s) => s.completed).length;

    onTaskUpdated({
      ...task,
      subtaskCount: remaining.length,
      completedSubtaskCount: nextCompletedCount,
    });
    onTaskDeleted(subId);

    await deleteTaskAction(subId);
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

  const selectedTagStyles = selectedTag
    ? getTagColorStyles(selectedTag.color)
    : null;

  const totalSubtasksToDelete = subtasks.length || task.subtaskCount || 0;

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
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 min-h-[20px]">
            {isSaving && (
              <span className="flex items-center gap-1.5 text-indigo-600 font-medium animate-in fade-in duration-150">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Salvando...
              </span>
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
          {/* Parent Task Banner if this is a subtask */}
          {task.parentId && (
            <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 bg-indigo-50/80 border border-indigo-100/90 rounded-2xl text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <CornerDownRight className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                <span className="text-slate-500 font-medium flex-shrink-0">Subtarefa de:</span>
                <span className="font-semibold text-indigo-700 truncate">
                  {task.parent?.title || "Tarefa Principal"}
                </span>
              </div>
              {onOpenTask && task.parentId && (
                <button
                  type="button"
                  onClick={() => onOpenTask(task.parentId!)}
                  className="inline-flex items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-800 hover:underline flex-shrink-0 cursor-pointer text-xs"
                >
                  <span>Ver tarefa principal</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

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

          {/* Date, Time & Duration clean single row */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Date Pill */}
            <div className="relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium bg-slate-100/70 hover:bg-slate-100 border border-slate-200/70 text-slate-700 transition-all cursor-pointer group">
              <Calendar className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0 pointer-events-none" />
              <span className="pointer-events-none">
                {date ? date.split("-").reverse().join("/") : "Sem data (Fixa)"}
              </span>
              {date ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDateChange("");
                  }}
                  className="relative z-10 text-slate-400 hover:text-rose-500 p-0.5 rounded transition-colors cursor-pointer"
                  title="Remover data (mover para Tarefas sem data)"
                >
                  <X className="w-3 h-3" />
                </button>
              ) : null}
              <input
                type="date"
                value={date}
                onChange={(e) => {
                  if (e.target.value) handleDateChange(e.target.value);
                }}
                onClick={(e) => {
                  try {
                    (e.target as HTMLInputElement).showPicker?.();
                  } catch {}
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-0"
                title={date ? "Alterar data" : "Definir data"}
              />
            </div>

            {/* Time Pill */}
            <div className="relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium bg-slate-100/70 hover:bg-slate-100 border border-slate-200/70 text-slate-700 transition-all cursor-pointer group">
              <Clock className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0 pointer-events-none" />
              {time ? (
                <>
                  <span className="pointer-events-none">{time}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTimeChange("");
                    }}
                    className="relative z-10 text-slate-400 hover:text-rose-500 p-0.5 rounded transition-colors cursor-pointer"
                    title="Remover horário"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </>
              ) : (
                <span className="text-slate-400 group-hover:text-slate-600 transition-colors pointer-events-none">
                  Adicionar horário
                </span>
              )}
              <input
                type="time"
                value={time}
                onChange={(e) => handleTimeChange(e.target.value)}
                onClick={(e) => {
                  try {
                    (e.target as HTMLInputElement).showPicker?.();
                  } catch {}
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-0"
                title={time ? `Horário: ${time}` : "Adicionar horário"}
              />
            </div>

            {/* Duration Pill */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium bg-slate-100/70 hover:bg-slate-100 border border-slate-200/70 text-slate-700 focus-within:bg-white focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-400/20 transition-all">
              <Timer className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
              <input
                type="text"
                value={durationText}
                onChange={(e) => handleDurationInputChange(e.target.value)}
                onBlur={handleDurationBlur}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                placeholder="Duração"
                className="bg-transparent text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none w-14 focus:w-20 transition-all"
              />
              {durationText && (
                <button
                  type="button"
                  onClick={handleClearDuration}
                  className="text-slate-400 hover:text-rose-500 p-0.5 rounded transition-colors cursor-pointer"
                  title="Limpar duração"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Compact Tag Line */}
          <div className="relative" ref={tagDropdownRef}>
            <div className="flex items-center gap-2">
              <TagIcon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />

              {selectedTag ? (
                <div className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsTagDropdownOpen((prev) => !prev);
                      setIsCreatingTag(false);
                      setTagError("");
                    }}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium border shadow-2xs hover:opacity-90 transition-all cursor-pointer ${
                      selectedTagStyles?.badgeClass || "bg-indigo-50 text-indigo-700 border-indigo-200"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        selectedTagStyles?.dotClass || "bg-indigo-500"
                      }`}
                    />
                    <span>{selectedTag.name}</span>
                    <ChevronDown className="w-3 h-3 opacity-60 ml-0.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectTag(null)}
                    className="text-slate-400 hover:text-rose-500 p-0.5 rounded-md transition-colors cursor-pointer"
                    title="Remover tag"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsTagDropdownOpen((prev) => !prev);
                    setIsCreatingTag(false);
                    setTagError("");
                  }}
                  className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-indigo-600 font-medium py-1 px-1.5 rounded-lg hover:bg-slate-100/70 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Adicionar tag</span>
                </button>
              )}
            </div>

            {/* Tag Dropdown Popover */}
            {isTagDropdownOpen && (
              <div className="absolute left-0 top-full mt-2 w-72 sm:w-80 bg-white rounded-2xl shadow-xl border border-slate-200 p-3 z-30 animate-in fade-in zoom-in-95 duration-150">
                {!isCreatingTag ? (
                  <div>
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 text-xs font-semibold text-slate-600">
                      <span>Selecionar Tag</span>
                      <button
                        type="button"
                        onClick={() => setIsCreatingTag(true)}
                        className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700 font-medium cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Nova Tag
                      </button>
                    </div>

                    {/* Tag list */}
                    <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                      {selectedTag && (
                        <button
                          type="button"
                          onClick={() => handleSelectTag(null)}
                          className="w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-medium text-rose-600 hover:bg-rose-50 flex items-center justify-between transition-colors cursor-pointer"
                        >
                          <span>Nenhuma (Remover tag)</span>
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {userTags.length === 0 ? (
                        <div className="py-4 text-center text-xs text-slate-400">
                          Nenhuma tag criada ainda.
                        </div>
                      ) : (
                        userTags.map((tag) => {
                          const styles = getTagColorStyles(tag.color);
                          const isSelected = selectedTag?.id === tag.id;

                          return (
                            <button
                              key={tag.id}
                              type="button"
                              onClick={() => handleSelectTag(tag)}
                              className={`w-full text-left px-2.5 py-2 rounded-xl text-xs font-medium flex items-center justify-between transition-all cursor-pointer ${
                                isSelected
                                  ? `${styles.badgeClass} ring-1 ring-indigo-400/40 font-semibold`
                                  : "hover:bg-slate-100/80 text-slate-700"
                              }`}
                            >
                              <span className="flex items-center gap-2">
                                <span
                                  className={`w-2 h-2 rounded-full ${styles.dotClass}`}
                                />
                                <span>{tag.name}</span>
                              </span>
                              {isSelected && (
                                <Check className="w-3.5 h-3.5 text-indigo-600" />
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                ) : (
                  /* Inline Tag Creation Form */
                  <form onSubmit={handleCreateNewTag} className="space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-xs font-semibold text-slate-700">
                      <span>Criar Nova Tag</span>
                      <button
                        type="button"
                        onClick={() => {
                          setIsCreatingTag(false);
                          setTagError("");
                        }}
                        className="text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {tagError && (
                      <div className="text-[11px] text-rose-600 font-medium bg-rose-50 p-2 rounded-lg">
                        {tagError}
                      </div>
                    )}

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                        Nome da Tag
                      </label>
                      <input
                        type="text"
                        autoFocus
                        value={newTagName}
                        onChange={(e) => setNewTagName(e.target.value)}
                        placeholder="Ex: Trabalho, Estudos, Pessoal..."
                        maxLength={50}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">
                        Cor da Tag
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {Object.values(TAG_COLORS).map((colorOpt) => (
                          <button
                            key={colorOpt.key}
                            type="button"
                            onClick={() => setNewTagColor(colorOpt.key)}
                            className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-[10px] font-medium transition-all cursor-pointer ${
                              newTagColor === colorOpt.key
                                ? `${colorOpt.badgeClass} ring-2 ring-indigo-500/30 font-bold border-indigo-400`
                                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            <span
                              className={`w-2 h-2 rounded-full ${colorOpt.dotClass}`}
                            />
                            <span className="truncate">{colorOpt.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          setIsCreatingTag(false);
                          setTagError("");
                        }}
                        className="px-2.5 py-1 text-slate-500 hover:bg-slate-100 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                      >
                        Voltar
                      </button>
                      <button
                        type="submit"
                        disabled={isCreatingTagLoading || !newTagName.trim()}
                        className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                      >
                        {isCreatingTagLoading && (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        )}
                        Salvar Tag
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>

          {/* Description / Content Rich Text Editor (WYSIWYG Tiptap) */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Descrição
            </label>
            <TaskDescriptionEditor
              value={content}
              onChange={handleContentChange}
            />
          </div>

          {/* Subtasks Section (Visible only for main tasks, i.e., !task.parentId) - Placed AFTER Descrição */}
          {!task.parentId && (
            <div className="space-y-3 p-4 bg-slate-50/70 rounded-2xl border border-slate-200/60">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <ListTree className="w-3.5 h-3.5 text-indigo-500" />
                  Subtarefas
                  {subtasks.length > 0 && (
                    <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200/60 shadow-2xs">
                      {subtasks.filter((s) => s.completed).length} de {subtasks.length} concluídas
                    </span>
                  )}
                </label>
              </div>

              {/* Subtasks List */}
              <div className="space-y-1.5">
                {isLoadingSubtasks && subtasks.length === 0 ? (
                  <div className="flex items-center gap-2 py-2 text-xs text-slate-400">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Carregando subtarefas...</span>
                  </div>
                ) : null}

                {subtasks.map((sub) => {
                  const isDiffDate = (sub.date || null) !== (date || null);
                  return (
                    <div
                      key={sub.id}
                      className={`group flex items-center justify-between gap-2.5 p-2 rounded-xl border transition-all text-xs ${
                        sub.completed
                          ? "bg-slate-100/60 border-slate-200/40 text-slate-400"
                          : "bg-white/90 hover:bg-white border-slate-200/80 text-slate-700 shadow-2xs"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => handleToggleSubtask(sub)}
                          className="text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer flex-shrink-0"
                          title={sub.completed ? "Marcar como pendente" : "Marcar como concluída"}
                        >
                          {sub.completed ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <Circle className="w-4 h-4 text-slate-300 hover:text-indigo-500" />
                          )}
                        </button>

                        <span
                          className={`truncate flex-1 font-medium ${
                            sub.completed ? "line-through text-slate-400" : "text-slate-700"
                          }`}
                        >
                          {sub.title}
                        </span>

                        {/* Tag pill if subtask has a tag */}
                        {sub.tag && (
                          <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md flex-shrink-0">
                            {sub.tag.name}
                          </span>
                        )}

                        {/* Date pill if subtask is scheduled on another day */}
                        {isDiffDate && sub.date && (
                          <span
                            className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200/60 px-1.5 py-0.5 rounded-md flex-shrink-0"
                            title={`Agendada para ${sub.date}`}
                          >
                            {sub.date.split("-").reverse().slice(0, 2).join("/")}
                          </span>
                        )}
                        {isDiffDate && !sub.date && (
                          <span
                            className="text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md flex-shrink-0"
                            title="Sem data definida"
                          >
                            Sem data
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        {onOpenTask && (
                          <button
                            type="button"
                            onClick={() => onOpenTask(sub)}
                            className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                            title="Abrir detalhes completos da subtarefa"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteSubtask(sub.id)}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Excluir subtarefa"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Quick Add Subtask Input */}
                <form onSubmit={handleCreateSubtask} className="pt-1">
                  <div className="relative">
                    <input
                      type="text"
                      value={newSubtaskTitle}
                      onChange={(e) => setNewSubtaskTitle(e.target.value)}
                      placeholder="+ Adicionar subtarefa... (Enter para salvar)"
                      disabled={isAddingSubtask}
                      className="w-full text-xs bg-white/80 hover:bg-white focus:bg-white border border-slate-200/80 rounded-xl pl-3 pr-8 py-2 text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all shadow-2xs"
                    />
                    {newSubtaskTitle.trim() && (
                      <button
                        type="submit"
                        disabled={isAddingSubtask}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-indigo-600 hover:text-indigo-700 p-0.5 cursor-pointer"
                        title="Adicionar subtarefa"
                      >
                        {isAddingSubtask ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Plus className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>
          )}
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
              <span className="text-rose-700 font-medium">
                {totalSubtasksToDelete > 0
                  ? `Excluir tarefa e suas ${totalSubtasksToDelete} subtarefas?`
                  : "Excluir tarefa?"}
              </span>
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
  onOpenTask,
  onSubtaskCreated,
}: TaskModalProps) {
  if (!isOpen || !task) return null;

  return (
    <TaskModalDialog
      key={task.id}
      task={task}
      onClose={onClose}
      onTaskUpdated={onTaskUpdated}
      onTaskDeleted={onTaskDeleted}
      onOpenTask={onOpenTask}
      onSubtaskCreated={onSubtaskCreated}
    />
  );
}

