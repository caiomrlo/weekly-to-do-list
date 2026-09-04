"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { TaskWithTag, Tag } from "@/db/schema";
import { updateTaskAction, deleteTaskAction } from "@/app/actions/tasks";
import { getUserTagsAction, createTagAction } from "@/app/actions/tags";
import { TAG_COLORS, getTagColorStyles } from "@/lib/tag-utils";
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
  Tag as TagIcon,
  Plus,
  ChevronDown,
} from "lucide-react";

interface TaskModalProps {
  task: TaskWithTag | null;
  isOpen: boolean;
  onClose: () => void;
  onTaskUpdated: (updatedTask: TaskWithTag) => void;
  onTaskDeleted: (taskId: string) => void;
}

interface TaskModalDialogProps {
  task: TaskWithTag;
  onClose: () => void;
  onTaskUpdated: (updatedTask: TaskWithTag) => void;
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
  const [selectedTag, setSelectedTag] = useState<Tag | null>(task.tag || null);

  // Tags list & creation state
  const [userTags, setUserTags] = useState<Tag[]>([]);
  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("indigo");
  const [isCreatingTagLoading, setIsCreatingTagLoading] = useState(false);
  const [tagError, setTagError] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, startDeleteTransition] = useTransition();

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const tagDropdownRef = useRef<HTMLDivElement>(null);

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
    date?: string;
    time?: string | null;
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

          {/* Date, Time & Tag Selectors */}
          <div className="space-y-3 p-3.5 bg-slate-50/70 rounded-2xl border border-slate-200/60">
            {/* Grid for Date & Time */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

            {/* Tag Selection Row */}
            <div className="pt-2 border-t border-slate-200/50 relative" ref={tagDropdownRef}>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <label className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                  <TagIcon className="w-3.5 h-3.5 text-indigo-500" />
                  Tag
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Current Tag Badge / Trigger */}
                {selectedTag ? (
                  <div
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border shadow-2xs ${
                      selectedTagStyles?.badgeClass || "bg-indigo-50 text-indigo-700 border-indigo-200"
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        selectedTagStyles?.dotClass || "bg-indigo-500"
                      }`}
                    />
                    <span>{selectedTag.name}</span>
                    <button
                      type="button"
                      onClick={() => handleSelectTag(null)}
                      className="ml-1 text-slate-400 hover:text-slate-700 rounded-full p-0.5 transition-colors cursor-pointer"
                      title="Remover tag"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : null}

                {/* Open Tag Selector Button */}
                <button
                  type="button"
                  onClick={() => {
                    setIsTagDropdownOpen((prev) => !prev);
                    setIsCreatingTag(false);
                    setTagError("");
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-white/80 hover:bg-white text-slate-700 border border-slate-200/80 shadow-2xs hover:border-indigo-300 transition-all cursor-pointer"
                >
                  <TagIcon className="w-3.5 h-3.5 text-slate-400" />
                  <span>{selectedTag ? "Alterar Tag" : "+ Adicionar Tag"}</span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>
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

