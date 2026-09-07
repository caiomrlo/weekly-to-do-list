"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { TaskWithTag, Project } from "@/db/schema";
import {
  updateTaskAction,
  deleteTaskAction,
  createTaskAction,
  getSubtasksAction,
  toggleTaskStatusAction,
} from "@/app/actions/tasks";
import { getUserProjectsAction } from "@/app/actions/projects";
import { formatDuration, parseNaturalDuration } from "@/lib/date-utils";
import { TaskDescriptionEditor } from "./TaskDescriptionEditor";
import { TaskParentBanner } from "./task-modal/TaskParentBanner";
import { TaskScheduleInputs } from "./task-modal/TaskScheduleInputs";
import { TaskProjectSelector } from "./task-modal/TaskProjectSelector";
import { TaskSubtasksSection } from "./task-modal/TaskSubtasksSection";
import { TaskAttachmentsSection } from "./task-modal/TaskAttachmentsSection";
import { TaskModalFooter } from "./task-modal/TaskModalFooter";
import { getTaskAttachmentsAction, AttachmentWithUrl } from "@/app/actions/attachments";
import { X, CheckCircle2, Circle, Loader2 } from "lucide-react";

export interface TaskModalProps {
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
  const [selectedProject, setSelectedProject] = useState<Project | null>(task.project || null);

  // Subtasks state
  const [subtasks, setSubtasks] = useState<TaskWithTag[]>([]);
  const [isLoadingSubtasks, setIsLoadingSubtasks] = useState(!task.parentId);

  // Attachments state
  const [attachments, setAttachments] = useState<AttachmentWithUrl[]>([]);
  const [isLoadingAttachments, setIsLoadingAttachments] = useState(true);

  // User projects state
  const [userProjects, setUserProjects] = useState<Project[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, startDeleteTransition] = useTransition();

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch attachments for this task
  useEffect(() => {
    let isMounted = true;
    getTaskAttachmentsAction(task.id).then((res) => {
      if (isMounted) {
        if (res.attachments) {
          setAttachments(res.attachments);
        }
        setIsLoadingAttachments(false);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [task.id]);

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

  // Fetch available user projects on load
  useEffect(() => {
    async function loadProjects() {
      const res = await getUserProjectsAction();
      if (res.projects) {
        setUserProjects(res.projects);
      }
    }
    loadProjects();
  }, []);

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
    date?: string | null;
    time?: string | null;
    duration?: number | null;
    tagId?: string | null;
    projectId?: string | null;
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
        console.error("Auto-save failed:", err);
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

  const handleSelectProject = (project: Project | null) => {
    setSelectedProject(project);
    triggerAutoSave({ projectId: project ? project.id : null });
  };

  const handleProjectCreated = (newProject: Project) => {
    setUserProjects((prev) => [...prev, newProject]);
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

  const handleCreateSubtask = async (subtaskTitle: string) => {
    try {
      const res = await createTaskAction({
        title: subtaskTitle,
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
      console.error("Error creating subtask:", err);
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

  const handleAttachmentsChange = (updated: AttachmentWithUrl[]) => {
    setAttachments(updated);
    onTaskUpdated({
      ...task,
      attachmentCount: updated.length,
    });
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

  const totalSubtasksToDelete = subtasks.length || task.subtaskCount || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div
        className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="relative w-full max-w-xl glass-panel rounded-3xl shadow-2xl p-6 sm:p-8 flex flex-col max-h-[90vh] overflow-hidden z-10 border border-white/80 dark:border-slate-800">
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200/50 dark:border-slate-800/60">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 min-h-[20px]">
            {isSaving && (
              <span className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-medium animate-in fade-in duration-150">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Saving...
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-5 space-y-5 pr-1">
          {task.parentId && (
            <TaskParentBanner
              parentId={task.parentId}
              parentTitle={task.parent?.title}
              onOpenTask={onOpenTask}
            />
          )}

          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={handleToggleCompleted}
              className="mt-1 text-slate-400 hover:text-indigo-600 dark:text-slate-500 dark:hover:text-indigo-400 transition-colors cursor-pointer flex-shrink-0"
              title={completed ? "Mark as pending" : "Mark as completed"}
            >
              {completed ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              ) : (
                <Circle className="w-6 h-6 text-slate-400 dark:text-slate-600 hover:text-indigo-500 dark:hover:text-indigo-400" />
              )}
            </button>

            <input
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Task title..."
              className={`w-full text-lg sm:text-xl font-semibold bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-indigo-500 focus:outline-none transition-colors px-1 py-0.5 text-slate-800 dark:text-slate-100 ${
                completed ? "line-through text-slate-400 dark:text-slate-500" : ""
              }`}
            />
          </div>

          <TaskScheduleInputs
            date={date}
            time={time}
            durationText={durationText}
            onDateChange={handleDateChange}
            onTimeChange={handleTimeChange}
            onDurationInputChange={handleDurationInputChange}
            onDurationBlur={handleDurationBlur}
            onClearDuration={handleClearDuration}
          />

          <TaskProjectSelector
            selectedProject={selectedProject}
            userProjects={userProjects}
            onSelectProject={handleSelectProject}
            onProjectCreated={handleProjectCreated}
          />

          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Description
            </label>
            <TaskDescriptionEditor
              value={content}
              onChange={handleContentChange}
            />
          </div>

          <TaskAttachmentsSection
            taskId={task.id}
            attachments={attachments}
            isLoading={isLoadingAttachments}
            onAttachmentsChange={handleAttachmentsChange}
          />

          {!task.parentId && (
            <TaskSubtasksSection
              subtasks={subtasks}
              isLoading={isLoadingSubtasks}
              parentDate={date}
              onToggleSubtask={handleToggleSubtask}
              onDeleteSubtask={handleDeleteSubtask}
              onCreateSubtask={handleCreateSubtask}
              onOpenTask={onOpenTask}
            />
          )}
        </div>

        <TaskModalFooter
          totalSubtasksToDelete={totalSubtasksToDelete}
          isDeleting={isDeleting}
          onDelete={handleDelete}
          onClose={onClose}
        />
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
