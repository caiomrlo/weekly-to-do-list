"use client";

import { useRef, useState, useTransition } from "react";
import { DocWithRelations, Project } from "@/db/schema";
import {
  updateDocAction,
  deleteDocAction,
  toggleDocFavoriteAction,
} from "@/app/actions/docs";
import { DocProjectSelector } from "./DocProjectSelector";
import { DocLinkedTasksSection } from "./DocLinkedTasksSection";
import { DocRichEditor } from "./DocRichEditor";
import {
  Star,
  Trash2,
  Loader2,
  ArrowLeft,
  X,
} from "lucide-react";

interface DocEditorProps {
  doc: DocWithRelations;
  userProjects: Project[];
  onDocUpdated: (updated: DocWithRelations) => void;
  onDocDeleted: (docId: string) => void;
  onBackToList?: () => void;
  onProjectCreated: (project: Project) => void;
}

export function DocEditor({
  doc,
  userProjects,
  onDocUpdated,
  onDocDeleted,
  onBackToList,
  onProjectCreated,
}: DocEditorProps) {
  const [title, setTitle] = useState(doc.title);
  const [content, setContent] = useState(doc.content || "");
  const [selectedProject, setSelectedProject] = useState<Project | null>(
    doc.project || null
  );
  const [isFavorite, setIsFavorite] = useState(doc.isFavorite);
  const [linkedTasks, setLinkedTasks] = useState(doc.tasks || []);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, startDeleteTransition] = useTransition();
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);


  // Debounced auto-save function
  const triggerAutoSave = (updates: {
    title?: string;
    content?: string;
    projectId?: string | null;
    isFavorite?: boolean;
  }) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    setIsSaving(true);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const res = await updateDocAction(doc.id, updates);
        if (res.doc) {
          onDocUpdated({
            ...doc,
            ...res.doc,
            project: selectedProject,
            tasks: linkedTasks,
          });
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

  const handleContentChange = (html: string) => {
    setContent(html);
    triggerAutoSave({ content: html });
  };

  const handleSelectProject = (project: Project | null) => {
    setSelectedProject(project);
    triggerAutoSave({ projectId: project ? project.id : null });
    onDocUpdated({
      ...doc,
      projectId: project ? project.id : null,
      project,
    });
  };

  const handleToggleFavorite = async () => {
    const nextFav = !isFavorite;
    setIsFavorite(nextFav);
    onDocUpdated({
      ...doc,
      isFavorite: nextFav,
    });
    try {
      await toggleDocFavoriteAction(doc.id, nextFav);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = () => {
    startDeleteTransition(async () => {
      const res = await deleteDocAction(doc.id);
      if (res.success) {
        onDocDeleted(doc.id);
      }
    });
  };

  const handleTaskUnlinked = (taskId: string) => {
    const remaining = linkedTasks.filter((t) => t.id !== taskId);
    setLinkedTasks(remaining);
    onDocUpdated({
      ...doc,
      tasks: remaining,
      taskCount: remaining.length,
    });
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto px-4 sm:px-8 py-6 space-y-5">
      {/* Top Header Controls Bar */}
      <div className="flex items-center justify-between gap-4 pb-3 border-b border-slate-200/60 dark:border-slate-800/80">
        <div className="flex items-center gap-3">
          {onBackToList && (
            <button
              type="button"
              onClick={onBackToList}
              className="lg:hidden p-2 rounded-xl bg-white/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-2xs hover:bg-slate-100 transition-colors cursor-pointer"
              title="Back to documents list"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}

          <DocProjectSelector
            selectedProject={selectedProject}
            userProjects={userProjects}
            onSelectProject={handleSelectProject}
            onProjectCreated={onProjectCreated}
          />
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Transient Saving Status */}
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 min-w-[70px] text-right">
            {isSaving && (
              <span className="inline-flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-medium animate-in fade-in duration-150">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Saving...
              </span>
            )}
          </div>

          {/* Favorite Toggle Button */}
          <button
            type="button"
            onClick={handleToggleFavorite}
            className={`p-2 rounded-xl border transition-all cursor-pointer ${
              isFavorite
                ? "bg-amber-50 dark:bg-amber-950/50 text-amber-500 border-amber-300 dark:border-amber-800"
                : "bg-white/80 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500 border-slate-200/80 dark:border-slate-700/80 hover:text-amber-500 hover:border-amber-200"
            }`}
            title={isFavorite ? "Remove from favorites" : "Add to favorites"}
          >
            <Star
              className={`w-4 h-4 ${
                isFavorite ? "fill-amber-400 text-amber-500" : ""
              }`}
            />
          </button>

          {/* Delete Confirmation or Button */}
          {isConfirmingDelete ? (
            <div className="flex items-center gap-1.5 p-1 px-2 rounded-xl bg-rose-50/90 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 text-xs animate-in fade-in duration-150">
              <span className="text-rose-700 dark:text-rose-300 font-medium text-xs">
                Delete doc?
              </span>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDelete}
                className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1 text-xs"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Confirm</span>
                )}
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setIsConfirmingDelete(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
                title="Cancel"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsConfirmingDelete(true)}
              className="p-2 rounded-xl bg-white/80 dark:bg-slate-800/80 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-200/80 dark:border-slate-700/80 hover:border-rose-200 dark:hover:border-rose-900 transition-all cursor-pointer"
              title="Delete document"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Document Title Input */}
      <div>
        <input
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Untitled Document"
          className="w-full text-2xl sm:text-3xl font-bold bg-transparent border-b border-transparent hover:border-slate-200 dark:hover:border-slate-700 focus:border-indigo-500 focus:outline-none transition-colors px-1 py-1 text-slate-800 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-600"
        />
      </div>

      {/* Linked Tasks Section */}
      <DocLinkedTasksSection
        docId={doc.id}
        tasks={linkedTasks}
        onTaskUnlinked={handleTaskUnlinked}
      />

      {/* Rich Text Editor */}
      <div className="flex-1 pb-8">
        <DocRichEditor value={content} onChange={handleContentChange} />
      </div>
    </div>
  );
}
