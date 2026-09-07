"use client";

import { useEffect, useRef, useState } from "react";
import { Project } from "@/db/schema";
import { createProjectAction } from "@/app/actions/projects";
import { PROJECT_COLORS, getProjectColorStyles } from "@/lib/project-utils";
import { Folder, Plus, ChevronDown, Check, X, Loader2 } from "lucide-react";

interface TaskProjectSelectorProps {
  selectedProject: Project | null;
  userProjects: Project[];
  onSelectProject: (project: Project | null) => void;
  onProjectCreated: (project: Project) => void;
}

export function TaskProjectSelector({
  selectedProject,
  userProjects,
  onSelectProject,
  onProjectCreated,
}: TaskProjectSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectColor, setNewProjectColor] = useState("indigo");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setIsCreating(false);
        setError("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newProjectName.trim();
    if (!trimmed) {
      setError("Project name is required.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const res = await createProjectAction({
        name: trimmed,
        color: newProjectColor,
      });

      if (res.project) {
        onProjectCreated(res.project);
        onSelectProject(res.project);
        setNewProjectName("");
        setIsCreating(false);
        setIsOpen(false);
      } else if (res.error) {
        setError(res.error);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to create project.");
    } finally {
      setIsLoading(false);
    }
  };

  const selectedProjectStyles = selectedProject
    ? getProjectColorStyles(selectedProject.color)
    : null;

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex items-center gap-2">
        <Folder className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />

        {selectedProject ? (
          <div className="inline-flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setIsOpen((prev) => !prev);
                setIsCreating(false);
                setError("");
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium border shadow-2xs hover:opacity-90 transition-all cursor-pointer ${
                selectedProjectStyles?.badgeClass ||
                "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800/60"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  selectedProjectStyles?.dotClass || "bg-indigo-500"
                }`}
              />
              <span>{selectedProject.name}</span>
              <ChevronDown className="w-3 h-3 opacity-60 ml-0.5" />
            </button>
            <button
              type="button"
              onClick={() => onSelectProject(null)}
              className="text-slate-400 hover:text-rose-500 p-0.5 rounded-md transition-colors cursor-pointer"
              title="Remove project"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setIsOpen((prev) => !prev);
              setIsCreating(false);
              setError("");
            }}
            className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium py-1 px-1.5 rounded-lg hover:bg-slate-100/70 dark:hover:bg-slate-800/70 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add project</span>
          </button>
        )}
      </div>

      {/* Popover */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-2 w-72 sm:w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-3 z-30 animate-in fade-in zoom-in-95 duration-150">
          {!isCreating ? (
            <div>
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300">
                <span>Select Project</span>
                <button
                  type="button"
                  onClick={() => setIsCreating(true)}
                  className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Project
                </button>
              </div>

              {/* Project list */}
              <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                {selectedProject && (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectProject(null);
                      setIsOpen(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <span>None (Remove project)</span>
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}

                {userProjects.length === 0 ? (
                  <div className="py-4 text-center text-xs text-slate-400 dark:text-slate-500">
                    No projects created yet.
                  </div>
                ) : (
                  userProjects.map((project) => {
                    const styles = getProjectColorStyles(project.color);
                    const isSelected = selectedProject?.id === project.id;

                    return (
                      <button
                        key={project.id}
                        type="button"
                        onClick={() => {
                          onSelectProject(project);
                          setIsOpen(false);
                        }}
                        className={`w-full text-left px-2.5 py-2 rounded-xl text-xs font-medium flex items-center justify-between transition-all cursor-pointer ${
                          isSelected
                            ? `${styles.badgeClass} ring-1 ring-indigo-400/40 font-semibold`
                            : "hover:bg-slate-100/80 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-200"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${styles.dotClass}`}
                          />
                          <span>{project.name}</span>
                        </span>
                        {isSelected && (
                          <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            /* Inline Project Creation Form */
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200">
                <span>Create New Project</span>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreating(false);
                    setError("");
                  }}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {error && (
                <div className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 p-2 rounded-lg border border-rose-200 dark:border-rose-900/50">
                  {error}
                </div>
              )}

              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="Project name..."
                maxLength={50}
                autoFocus
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />

              {/* Color swatches */}
              <div className="space-y-1">
                <span className="text-[11px] text-slate-400 block">Color</span>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(PROJECT_COLORS).map(([key, c]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setNewProjectColor(key)}
                      title={c.label}
                      className={`w-5 h-5 rounded-full ${c.dotClass} transition-all cursor-pointer flex items-center justify-center ${
                        newProjectColor === key
                          ? "ring-2 ring-offset-2 ring-indigo-500 scale-110"
                          : "hover:scale-105 opacity-80 hover:opacity-100"
                      }`}
                    >
                      {newProjectColor === key && (
                        <Check className="w-2.5 h-2.5 text-white" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreating(false);
                    setError("");
                  }}
                  className="px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 text-white rounded-xl text-xs font-medium shadow-xs transition-all cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Project</span>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
