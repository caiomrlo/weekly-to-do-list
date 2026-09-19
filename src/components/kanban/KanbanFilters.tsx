"use client";

import React, { useState, useRef, useEffect } from "react";
import { Project } from "@/db/schema";
import {
  KanbanDateFilter,
  KanbanProjectFilter,
} from "@/lib/kanban-filter-utils";
import { getProjectColorStyles } from "@/lib/project-utils";
import {
  FolderKanban,
  Calendar,
  ChevronDown,
  Check,
} from "lucide-react";

export interface KanbanFiltersProps {
  projects: Project[];
  selectedProjectId: KanbanProjectFilter;
  onSelectProject: (projectId: KanbanProjectFilter) => void;
  dateFilter: KanbanDateFilter;
  onSelectDateFilter: (filter: KanbanDateFilter) => void;
}

const DATE_FILTER_OPTIONS: { id: KanbanDateFilter; label: string }[] = [
  { id: "default", label: "Default" },
  { id: "this_week", label: "This Week" },
  { id: "this_month", label: "This Month" },
  { id: "all", label: "All Time" },
];

export function KanbanFilters({
  projects,
  selectedProjectId,
  onSelectProject,
  dateFilter,
  onSelectDateFilter,
}: KanbanFiltersProps) {
  const [isProjectOpen, setIsProjectOpen] = useState(false);
  const [isDateOpen, setIsDateOpen] = useState(false);

  const projectRef = useRef<HTMLDivElement>(null);
  const dateRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        projectRef.current &&
        !projectRef.current.contains(e.target as Node)
      ) {
        setIsProjectOpen(false);
      }
      if (
        dateRef.current &&
        !dateRef.current.contains(e.target as Node)
      ) {
        setIsDateOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isProjectFiltered = selectedProjectId !== "all";
  const isDateFiltered = dateFilter !== "default";

  // Selected project label & color
  const selectedProject =
    isProjectFiltered && selectedProjectId !== "none"
      ? projects.find((p) => p.id === selectedProjectId)
      : null;

  const projectButtonLabel =
    selectedProjectId === "all"
      ? "All Projects"
      : selectedProject?.name || "Project";

  const dateButtonLabel =
    DATE_FILTER_OPTIONS.find((opt) => opt.id === dateFilter)?.label || "Date";

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      {/* Project Filter Popover */}
      <div className="relative" ref={projectRef}>
        <button
          type="button"
          onClick={() => {
            setIsProjectOpen((prev) => !prev);
            setIsDateOpen(false);
          }}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer select-none max-w-[160px] sm:max-w-[200px] ${
            isProjectFiltered
              ? "bg-amber-500/10 border-amber-300/80 dark:border-amber-700/60 text-amber-700 dark:text-amber-300 hover:bg-amber-500/15"
              : "bg-white/80 dark:bg-slate-900/80 border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-900"
          }`}
          title={`Filter by Project: ${projectButtonLabel}`}
        >
          {selectedProject ? (
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                getProjectColorStyles(selectedProject.color).dotClass
              }`}
            />
          ) : (
            <FolderKanban className="w-3.5 h-3.5 shrink-0 text-slate-400 dark:text-slate-500" />
          )}
          <span className="truncate">{projectButtonLabel}</span>
          <ChevronDown className="w-3 h-3 shrink-0 text-slate-400 opacity-70 ml-0.5" />
        </button>

        {isProjectOpen && (
          <div className="absolute left-0 mt-1.5 w-56 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl rounded-2xl p-1.5 animate-in fade-in zoom-in-95 duration-100">
            <div className="space-y-0.5">
              <button
                type="button"
                onClick={() => {
                  onSelectProject("all");
                  setIsProjectOpen(false);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer text-left ${
                  selectedProjectId === "all"
                    ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 font-semibold"
                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60"
                }`}
              >
                <span>All Projects</span>
                {selectedProjectId === "all" && (
                  <Check className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                )}
              </button>

              {projects.length > 0 && (
                <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />
              )}

              {projects.map((proj) => {
                const isSelected = selectedProjectId === proj.id;
                const pStyles = getProjectColorStyles(proj.color);
                return (
                  <button
                    key={proj.id}
                    type="button"
                    onClick={() => {
                      onSelectProject(proj.id);
                      setIsProjectOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer text-left ${
                      isSelected
                        ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 font-semibold"
                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${pStyles.dotClass}`}
                      />
                      <span className="truncate">{proj.name}</span>
                    </div>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Date Filter Popover */}
      <div className="relative" ref={dateRef}>
        <button
          type="button"
          onClick={() => {
            setIsDateOpen((prev) => !prev);
            setIsProjectOpen(false);
          }}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer select-none ${
            isDateFiltered
              ? "bg-amber-500/10 border-amber-300/80 dark:border-amber-700/60 text-amber-700 dark:text-amber-300 hover:bg-amber-500/15"
              : "bg-white/80 dark:bg-slate-900/80 border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-900"
          }`}
          title={`Filter by Date: ${dateButtonLabel}`}
        >
          <Calendar className="w-3.5 h-3.5 shrink-0 text-slate-400 dark:text-slate-500" />
          <span>{dateButtonLabel}</span>
          <ChevronDown className="w-3 h-3 shrink-0 text-slate-400 opacity-70 ml-0.5" />
        </button>

        {isDateOpen && (
          <div className="absolute left-0 mt-1.5 w-44 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl rounded-2xl p-1.5 animate-in fade-in zoom-in-95 duration-100">
            <div className="space-y-0.5">
              {DATE_FILTER_OPTIONS.map((opt) => {
                const isSelected = dateFilter === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      onSelectDateFilter(opt.id);
                      setIsDateOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer text-left ${
                      isSelected
                        ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 font-semibold"
                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60"
                    }`}
                  >
                    <span>{opt.label}</span>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
