"use client";

import { useEffect, useRef, useState, useTransition, useCallback } from "react";
import { TaskWithTag, Project, RecurringRule, RecurrenceFrequency, TaskStatus, TaskAssigneeUser } from "@/db/schema";
import {
  updateTaskAction,
  deleteTaskAction,
  createTaskAction,
  getSubtasksAction,
  toggleTaskStatusAction,
  updateTaskRecurrenceAction,
} from "@/app/actions/tasks";
import { getUserProjectsAction } from "@/app/actions/projects";
import { getWorkspaceTaskStatusesAction } from "@/app/actions/task-statuses";
import { formatDuration, parseNaturalDuration } from "@/lib/date-utils";
import { TaskDescriptionEditor } from "./TaskDescriptionEditor";
import { TaskParentBanner } from "./TaskParentBanner";
import { TaskScheduleInputs } from "./TaskScheduleInputs";
import { ProjectSelector } from "@/components/shared/ProjectSelector";
import { StatusSelector } from "@/components/shared/StatusSelector";
import { TaskAssigneeSelector } from "./TaskAssigneeSelector";
import { TaskSubtasksSection } from "./TaskSubtasksSection";
import { AttachmentsAndDocsSection } from "@/components/shared/AttachmentsAndDocsSection";
import { TaskModalFooter } from "./TaskModalFooter";
import { RecurrenceSelector } from "./RecurrenceSelector";
import { EditRecurringTaskModal } from "./EditRecurringTaskModal";
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
  onProjectUpdated?: (project: Project) => void;
  currentWeekRange?: { startDate: string; endDate: string };
  onTasksBatchSync?: (params: {
    updatedTask?: TaskWithTag;
    newTasks?: TaskWithTag[];
    deletedTaskIds?: string[];
  }) => void;
}

interface TaskModalDialogProps {
  task: TaskWithTag;
  onClose: () => void;
  onTaskUpdated: (updatedTask: TaskWithTag) => void;
  onTaskDeleted: (taskId: string) => void;
  onOpenTask?: (task: TaskWithTag | string) => void;
  onSubtaskCreated?: (subtask: TaskWithTag) => void;
  onProjectUpdated?: (project: Project) => void;
  currentWeekRange?: { startDate: string; endDate: string };
  onTasksBatchSync?: (params: {
    updatedTask?: TaskWithTag;
    newTasks?: TaskWithTag[];
    deletedTaskIds?: string[];
  }) => void;
}

function TaskModalDialog({
  task,
  onClose,
  onTaskUpdated,
  onTaskDeleted,
  onOpenTask,
  onSubtaskCreated,
  onProjectUpdated,
  currentWeekRange,
  onTasksBatchSync,
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
  const [currentRule, setCurrentRule] = useState<RecurringRule | null>(
    task.recurringRule || null
  );
  const [isRecurrenceSelectorOpen, setIsRecurrenceSelectorOpen] = useState(false);
  const [isEditRecurringModalOpen, setIsEditRecurringModalOpen] = useState(false);
  const [hasFieldEdits, setHasFieldEdits] = useState(false);
  const [isSavingRecurrence, setIsSavingRecurrence] = useState(false);

  // Subtasks state
  const [subtasks, setSubtasks] = useState<TaskWithTag[]>([]);
  const [isLoadingSubtasks, setIsLoadingSubtasks] = useState(!task.parentId);

  // Attachments state
  const [attachments, setAttachments] = useState<AttachmentWithUrl[]>([]);
  const [isLoadingAttachments, setIsLoadingAttachments] = useState(true);

  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<TaskStatus | null>(task.status || null);
  const [userProjects, setUserProjects] = useState<Project[]>([]);
  const [assignees, setAssignees] = useState<TaskAssigneeUser[]>(task.assignees || []);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, startDeleteTransition] = useTransition();

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleAssigneesChange = (newAssignees: TaskAssigneeUser[]) => {
    setAssignees(newAssignees);
    onTaskUpdated({
      ...task,
      assignees: newAssignees,
    });
  };

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

  // Fetch subtasks if parent
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

  // Fetch available user projects and statuses on load
  useEffect(() => {
    async function loadData() {
      const [pRes, sRes] = await Promise.all([
        getUserProjectsAction(),
        getWorkspaceTaskStatusesAction(),
      ]);
      if (pRes.projects) {
        setUserProjects(pRes.projects);
      }
      if (sRes.statuses) {
        setStatuses(sRes.statuses);
        if (!task.status && task.statusId) {
          const match = sRes.statuses.find((s) => s.id === task.statusId);
          if (match) setSelectedStatus(match);
        } else if (!task.status && !task.statusId) {
          const defaultMatch = sRes.statuses.find((s) => s.isDefault) || sRes.statuses[0];
          if (defaultMatch) setSelectedStatus(defaultMatch);
        }
      }
    }
    loadData();
  }, [task.status, task.statusId]);

  const handleCloseAttempt = useCallback(() => {
    if ((task.recurringRuleId || currentRule) && hasFieldEdits) {
      setIsEditRecurringModalOpen(true);
    } else {
      onClose();
    }
  }, [task.recurringRuleId, currentRule, hasFieldEdits, onClose]);

  // Prevent page scroll when modal is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // Handle escape key to close modal
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        handleCloseAttempt();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleCloseAttempt]);

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
    setHasFieldEdits(true);
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
    onTaskUpdated({
      ...task,
      project: project || null,
      projectId: project ? project.id : null,
    });
  };

  const handleProjectCreated = (newProject: Project) => {
    setUserProjects((prev) => [...prev, newProject]);
  };

  const handleProjectUpdated = (updatedProject: Project) => {
    setUserProjects((prev) =>
      prev.map((p) => (p.id === updatedProject.id ? updatedProject : p))
    );
    if (selectedProject?.id === updatedProject.id || task.projectId === updatedProject.id) {
      setSelectedProject(updatedProject);
      onTaskUpdated({
        ...task,
        project: updatedProject,
      });
    }
    setSubtasks((prev) =>
      prev.map((s) =>
        s.projectId === updatedProject.id ? { ...s, project: updatedProject } : s
      )
    );
    onProjectUpdated?.(updatedProject);
  };

  const handleSelectStatus = async (status: TaskStatus) => {
    setSelectedStatus(status);
    const newCompleted = status.category === "done";
    setCompleted(newCompleted);
    setIsSaving(true);
    try {
      const res = await updateTaskAction(task.id, {
        statusId: status.id,
      });
      if (res.task) {
        onTaskUpdated(res.task);
      }
    } catch (err) {
      console.error("Error updating status:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleCompleted = async () => {
    const newCompleted = !completed;
    setCompleted(newCompleted);

    if (statuses.length > 0) {
      if (newCompleted) {
        const doneStatus = statuses.find((s) => s.category === "done");
        if (doneStatus) setSelectedStatus(doneStatus);
      } else {
        const todoStatus =
          statuses.find((s) => s.isDefault) ||
          statuses.find((s) => s.category === "todo") ||
          statuses[0];
        if (todoStatus) setSelectedStatus(todoStatus);
      }
    }

    try {
      const res = await toggleTaskStatusAction(task.id, newCompleted);
      if (res.success) {
        onTaskUpdated({ ...task, completed: newCompleted });
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

  const handleDocsCountChange = (count: number) => {
    onTaskUpdated({
      ...task,
      docCount: count,
    });
  };

  const handleConfirmEditScope = async (scope: "this" | "future") => {
    if (scope === "future") {
      setIsSaving(true);
      try {
        const res = await updateTaskAction(task.id, {
          title,
          content,
          date: date || null,
          time: time || null,
          duration,
          projectId: selectedProject ? selectedProject.id : null,
          editScope: "future",
        });
        if (res.task) {
          onTaskUpdated(res.task);
        }
      } catch (err) {
        console.error("Failed to apply future updates:", err);
      } finally {
        setIsSaving(false);
        setIsEditRecurringModalOpen(false);
        onClose();
      }
    } else {
      setIsEditRecurringModalOpen(false);
      onClose();
    }
  };

  const handleSaveRecurrence = async (params: {
    frequency: RecurrenceFrequency | "none";
    interval: number;
    daysOfWeek?: number[];
    dayOfMonth?: number;
    monthOfYear?: number;
    endDate?: string | null;
  }) => {
    setIsSavingRecurrence(true);
    try {
      const res = await updateTaskRecurrenceAction({
        taskId: task.id,
        ...params,
        currentWeekRange,
      });
      if (res.task) {
        setCurrentRule(res.task.recurringRule || null);
        onTaskUpdated(res.task);
        if (onTasksBatchSync) {
          onTasksBatchSync({
            updatedTask: res.task,
            newTasks: res.newTasks,
            deletedTaskIds: res.deletedTaskIds,
          });
        }
      }
    } catch (err) {
      console.error("Failed to update recurrence:", err);
    } finally {
      setIsSavingRecurrence(false);
    }
  };

  const handleDelete = (scope: "this" | "future" | "all" = "this") => {
    startDeleteTransition(async () => {
      const res = await deleteTaskAction(task.id, scope);
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
        className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={handleCloseAttempt}
      />

      <div className="relative w-full max-w-xl glass-panel rounded-3xl shadow-2xl p-6 sm:p-8 flex flex-col max-h-[90vh] overflow-hidden z-10 border border-white/80 dark:border-neutral-800">
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200/50 dark:border-neutral-800/60">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-neutral-400 min-h-[20px]">
            {isSaving && (
              <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium animate-in fade-in duration-150">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Saving...
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleCloseAttempt}
              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-neutral-200 hover:bg-slate-200/50 dark:hover:bg-neutral-800/60 transition-colors cursor-pointer"
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
              className="mt-1 text-slate-400 hover:text-amber-600 dark:text-slate-500 dark:hover:text-amber-400 transition-colors cursor-pointer flex-shrink-0"
              title={completed ? "Mark as pending" : "Mark as completed"}
            >
              {completed ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              ) : (
                <Circle className="w-6 h-6 text-slate-400 dark:text-slate-600 hover:text-amber-500 dark:hover:text-amber-400" />
              )}
            </button>

            <input
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Task title..."
              className={`w-full text-lg sm:text-xl font-semibold bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-amber-500 focus:outline-none transition-colors px-1 py-0.5 text-slate-800 dark:text-slate-100 ${
                completed ? "line-through text-slate-400 dark:text-slate-500" : ""
              }`}
            />
          </div>

          <TaskScheduleInputs
            date={date}
            time={time}
            durationText={durationText}
            isSubtask={Boolean(task.parentId)}
            recurringRule={currentRule}
            onDateChange={handleDateChange}
            onTimeChange={handleTimeChange}
            onDurationInputChange={handleDurationInputChange}
            onDurationBlur={handleDurationBlur}
            onClearDuration={handleClearDuration}
            onOpenRecurrence={() => setIsRecurrenceSelectorOpen(true)}
          />

          <div className="flex flex-wrap items-center gap-2">
            <StatusSelector
              selectedStatus={selectedStatus}
              statuses={statuses}
              onSelectStatus={handleSelectStatus}
            />
            <ProjectSelector
              selectedProject={selectedProject}
              userProjects={userProjects}
              onSelectProject={handleSelectProject}
              onProjectCreated={handleProjectCreated}
              onProjectUpdated={handleProjectUpdated}
            />
            <TaskAssigneeSelector
              taskId={task.id}
              workspaceId={task.workspaceId}
              assignees={assignees}
              onAssigneesChange={handleAssigneesChange}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Description
            </label>
            <TaskDescriptionEditor
              value={content}
              onChange={handleContentChange}
            />
          </div>

          <AttachmentsAndDocsSection
            target={{ type: "task", id: task.id }}
            attachments={attachments}
            isLoading={isLoadingAttachments}
            onAttachmentsChange={handleAttachmentsChange}
            onDocsCountChange={handleDocsCountChange}
            variant="modal"
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
          isRecurring={Boolean(task.recurringRuleId || currentRule)}
          isDeleting={isDeleting}
          onDelete={handleDelete}
          onClose={handleCloseAttempt}
        />
      </div>

      <RecurrenceSelector
        isOpen={isRecurrenceSelectorOpen}
        onClose={() => setIsRecurrenceSelectorOpen(false)}
        currentRule={currentRule}
        taskDate={date}
        onSave={handleSaveRecurrence}
        isSaving={isSavingRecurrence}
      />

      <EditRecurringTaskModal
        isOpen={isEditRecurringModalOpen}
        onClose={() => {
          setIsEditRecurringModalOpen(false);
          onClose();
        }}
        onConfirm={handleConfirmEditScope}
        isSaving={isSaving}
      />
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
  onProjectUpdated,
  currentWeekRange,
  onTasksBatchSync,
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
      onProjectUpdated={onProjectUpdated}
      currentWeekRange={currentWeekRange}
      onTasksBatchSync={onTasksBatchSync}
    />
  );
}
