"use client";

import { useState } from "react";
import { DocWithRelations, Project } from "@/db/schema";
import { getProjectColorStyles } from "@/lib/project-utils";
import {
  Plus,
  FileText,
  X,
  Search,
  Loader2,
  Folder,
} from "lucide-react";

export interface DocPickerPopoverProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  isCardVariant: boolean;
  availableDocs: DocWithRelations[];
  linkedDocs: DocWithRelations[];
  userProjects: Project[];
  isLoadingAvailableDocs: boolean;
  linkingDocId: string | null;
  isSubmittingDoc: boolean;
  onLinkDoc: (doc: DocWithRelations) => void;
  onCreateAndLinkDoc: (title: string, projectId: string | null) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function DocPickerPopover({
  isOpen,
  onToggle,
  onClose,
  isCardVariant,
  availableDocs,
  linkedDocs,
  userProjects,
  isLoadingAvailableDocs,
  linkingDocId,
  isSubmittingDoc,
  onLinkDoc,
  onCreateAndLinkDoc,
  containerRef,
}: DocPickerPopoverProps) {
  const [docSearch, setDocSearch] = useState("");
  const [isCreatingNewDoc, setIsCreatingNewDoc] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState("");
  const [newDocProjectId, setNewDocProjectId] = useState<string | null>(null);

  const unlinkedDocs = availableDocs.filter(
    (d) => !linkedDocs.some((ld) => ld.id === d.id)
  );

  const filteredAvailableDocs = unlinkedDocs.filter((d) => {
    if (!docSearch.trim()) return true;
    return d.title.toLowerCase().includes(docSearch.toLowerCase().trim());
  });

  const handleClose = () => {
    setIsCreatingNewDoc(false);
    setDocSearch("");
    setNewDocTitle("");
    setNewDocProjectId(null);
    onClose();
  };

  const handleSubmitNewDoc = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newDocTitle.trim();
    if (!trimmed) return;

    onCreateAndLinkDoc(trimmed, newDocProjectId);
    setNewDocTitle("");
    setNewDocProjectId(null);
    setIsCreatingNewDoc(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={onToggle}
        className={`inline-flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors cursor-pointer ${
          isCardVariant ? "px-2 py-0.5 rounded-md" : "px-2.5 py-1 rounded-lg"
        }`}
        title="Link or create a document for this task"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>Add Doc</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-white dark:bg-neutral-900 rounded-2xl shadow-xl border border-slate-200 dark:border-neutral-800 p-3 z-50 animate-in fade-in zoom-in-95 duration-150">
          {!isCreatingNewDoc ? (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-neutral-800 text-xs font-semibold text-slate-700 dark:text-slate-200">
                <span className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-amber-500" />
                  Link Document
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsCreatingNewDoc(true)}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 hover:text-amber-700 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 px-2 py-0.5 rounded-lg transition-colors cursor-pointer border border-amber-200/60 dark:border-amber-800/60"
                  >
                    <Plus className="w-3 h-3" />
                    <span>New Doc</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Search bar */}
              <div className="relative">
                <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={docSearch}
                  onChange={(e) => setDocSearch(e.target.value)}
                  placeholder="Search existing docs..."
                  autoFocus
                  className="w-full text-xs pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-amber-500 transition-all"
                />
              </div>

              {/* Docs List */}
              <div className="max-h-48 overflow-y-auto space-y-1 pr-0.5">
                {isLoadingAvailableDocs ? (
                  <div className="py-4 text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
                    <span>Loading docs...</span>
                  </div>
                ) : filteredAvailableDocs.length === 0 ? (
                  <div className="py-4 text-center text-xs text-slate-400 space-y-1">
                    <p>No available documents found.</p>
                    <button
                      type="button"
                      onClick={() => setIsCreatingNewDoc(true)}
                      className="text-amber-600 dark:text-amber-400 hover:underline cursor-pointer font-medium"
                    >
                      Create a new doc
                    </button>
                  </div>
                ) : (
                  filteredAvailableDocs.map((doc) => {
                    const projectStyles = doc.project
                      ? getProjectColorStyles(doc.project.color)
                      : null;
                    const isLinkingThis = linkingDocId === doc.id;

                    return (
                      <button
                        key={doc.id}
                        type="button"
                        onClick={() => onLinkDoc(doc)}
                        disabled={isLinkingThis}
                        className="w-full text-left px-2.5 py-2 rounded-xl text-xs hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-colors flex items-center justify-between gap-2 cursor-pointer group disabled:opacity-50"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="font-medium text-slate-700 dark:text-slate-200 truncate block group-hover:text-amber-600 dark:group-hover:text-amber-400">
                            {doc.title || "Untitled Document"}
                          </span>
                          {doc.project && projectStyles && (
                            <span
                              className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] border mt-0.5 ${projectStyles.badgeClass}`}
                            >
                              <span
                                className={`w-1 h-1 rounded-full ${projectStyles.dotClass}`}
                              />
                              <span>{doc.project.name}</span>
                            </span>
                          )}
                        </div>
                        <div className="shrink-0 text-slate-400 group-hover:text-amber-600">
                          {isLinkingThis ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
                          ) : (
                            <Plus className="w-3.5 h-3.5" />
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            /* Inline Doc Creation Form */
            <form onSubmit={handleSubmitNewDoc} className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-neutral-800 text-xs font-semibold text-slate-700 dark:text-slate-200">
                <span>Create & Link Doc</span>
                <button
                  type="button"
                  onClick={() => setIsCreatingNewDoc(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <input
                type="text"
                value={newDocTitle}
                onChange={(e) => setNewDocTitle(e.target.value)}
                placeholder="Document title..."
                autoFocus
                required
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-amber-500 transition-all"
              />

              {userProjects.length > 0 && (
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Folder className="w-3 h-3" />
                    <span>Project (Optional)</span>
                  </label>
                  <select
                    value={newDocProjectId || ""}
                    onChange={(e) => setNewDocProjectId(e.target.value || null)}
                    className="w-full text-xs px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 text-slate-800 dark:text-slate-100 focus:outline-none"
                  >
                    <option value="">No Project</option>
                    {userProjects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsCreatingNewDoc(false)}
                  className="px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDoc || !newDocTitle.trim()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 disabled:opacity-50 text-white rounded-xl text-xs font-medium shadow-xs transition-all cursor-pointer"
                >
                  {isSubmittingDoc ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <span>Create & Link</span>
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
