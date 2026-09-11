"use client";

import { useEffect, useState, useRef, useTransition } from "react";
import { DocWithRelations, Project } from "@/db/schema";
import {
  getTaskDocsAction,
  linkDocToTaskAction,
  unlinkDocFromTaskAction,
  createAndLinkDocAction,
  getUserDocsAction,
} from "@/app/actions/docs";
import { getUserProjectsAction } from "@/app/actions/projects";
import { getProjectColorStyles } from "@/lib/project-utils";
import {
  FileText,
  Plus,
  ExternalLink,
  X,
  Search,
  Loader2,
  Folder,
} from "lucide-react";

interface TaskDocsSectionProps {
  taskId: string;
  onDocsCountChange?: (count: number) => void;
}

export function TaskDocsSection({
  taskId,
  onDocsCountChange,
}: TaskDocsSectionProps) {
  const [linkedDocs, setLinkedDocs] = useState<DocWithRelations[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Popover state
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [availableDocs, setAvailableDocs] = useState<DocWithRelations[]>([]);
  const [isLoadingAvailable, setIsLoadingAvailable] = useState(false);

  // Inline creation state inside popover
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newProjectId, setNewProjectId] = useState<string | null>(null);
  const [userProjects, setUserProjects] = useState<Project[]>([]);
  const [isSubmitting, startSubmitTransition] = useTransition();
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);

  const popoverRef = useRef<HTMLDivElement>(null);

  // Load linked docs on mount
  useEffect(() => {
    let isMounted = true;

    getTaskDocsAction(taskId).then((res) => {
      if (isMounted) {
        if (res.docs) {
          setLinkedDocs(res.docs);
        }
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [taskId]);

  // Close popover on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsCreatingNew(false);
        setSearchQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch available docs & projects when opening popover
  const handleOpenPopover = async () => {
    setIsOpen(true);
    setIsCreatingNew(false);
    setSearchQuery("");
    setIsLoadingAvailable(true);

    try {
      const [docsRes, projRes] = await Promise.all([
        getUserDocsAction(),
        getUserProjectsAction(),
      ]);
      if (docsRes.docs) {
        setAvailableDocs(docsRes.docs);
      }
      if (projRes.projects) {
        setUserProjects(projRes.projects);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingAvailable(false);
    }
  };

  // Link an existing doc
  const handleLinkDoc = async (doc: DocWithRelations) => {
    try {
      const res = await linkDocToTaskAction(taskId, doc.id);
      if (res.success && res.doc) {
        const next = [res.doc, ...linkedDocs];
        setLinkedDocs(next);
        onDocsCountChange?.(next.length);
        setIsOpen(false);
      }
    } catch (err) {
      console.error("Failed to link doc:", err);
    }
  };

  // Unlink a doc
  const handleUnlinkDoc = async (docId: string) => {
    setUnlinkingId(docId);
    try {
      const res = await unlinkDocFromTaskAction(taskId, docId);
      if (res.success) {
        const next = linkedDocs.filter((d) => d.id !== docId);
        setLinkedDocs(next);
        onDocsCountChange?.(next.length);
      }
    } catch (err) {
      console.error("Failed to unlink doc:", err);
    } finally {
      setUnlinkingId(null);
    }
  };

  // Create new doc and link
  const handleCreateAndLink = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTitle.trim();
    if (!trimmed) return;

    startSubmitTransition(async () => {
      try {
        const res = await createAndLinkDocAction(taskId, {
          title: trimmed,
          projectId: newProjectId,
        });

        if (res.doc) {
          const next = [res.doc, ...linkedDocs];
          setLinkedDocs(next);
          onDocsCountChange?.(next.length);
          setNewTitle("");
          setNewProjectId(null);
          setIsCreatingNew(false);
          setIsOpen(false);
        }
      } catch (err) {
        console.error("Failed to create and link doc:", err);
      }
    });
  };

  // Filter docs for search in popover
  const unlinkedDocs = availableDocs.filter(
    (d) => !linkedDocs.some((ld) => ld.id === d.id)
  );

  const filteredAvailableDocs = unlinkedDocs.filter((d) => {
    if (!searchQuery.trim()) return true;
    return d.title.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="space-y-2.5">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" />
            Docs & Notes
          </label>
          {linkedDocs.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60">
              {linkedDocs.length}
            </span>
          )}
        </div>

        {/* Link Doc Trigger */}
        <div className="relative" ref={popoverRef}>
          <button
            type="button"
            onClick={handleOpenPopover}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg text-slate-600 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Link Doc</span>
          </button>

          {/* Popover */}
          {isOpen && (
            <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-3 z-30 animate-in fade-in zoom-in-95 duration-150">
              {!isCreatingNew ? (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200">
                    <span>Link Document</span>
                    <button
                      type="button"
                      onClick={() => setIsCreatingNew(true)}
                      className="inline-flex items-center gap-1 text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 font-medium cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>New Doc</span>
                    </button>
                  </div>

                  {/* Search bar */}
                  <div className="relative">
                    <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search existing docs..."
                      autoFocus
                      className="w-full text-xs pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                    />
                  </div>

                  {/* Docs List */}
                  <div className="max-h-48 overflow-y-auto space-y-1 pr-0.5">
                    {isLoadingAvailable ? (
                      <div className="py-4 text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Loading docs...</span>
                      </div>
                    ) : filteredAvailableDocs.length === 0 ? (
                      <div className="py-4 text-center text-xs text-slate-400 space-y-1">
                        <p>No available documents found.</p>
                        <button
                          type="button"
                          onClick={() => setIsCreatingNew(true)}
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

                        return (
                          <button
                            key={doc.id}
                            type="button"
                            onClick={() => handleLinkDoc(doc)}
                            className="w-full text-left px-2.5 py-2 rounded-xl text-xs hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-colors flex items-center justify-between gap-2 cursor-pointer group"
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
                            <Plus className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-600 shrink-0" />
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : (
                /* Inline Doc Creation Form */
                <form onSubmit={handleCreateAndLink} className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200">
                    <span>Create & Link Doc</span>
                    <button
                      type="button"
                      onClick={() => setIsCreatingNew(false)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Document title..."
                    autoFocus
                    required
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                  />

                  {/* Optional project dropdown */}
                  {userProjects.length > 0 && (
                    <div className="space-y-1">
                      <label className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Folder className="w-3 h-3" />
                        <span>Project (Optional)</span>
                      </label>
                      <select
                        value={newProjectId || ""}
                        onChange={(e) => setNewProjectId(e.target.value || null)}
                        className="w-full text-xs px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none"
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

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setIsCreatingNew(false)}
                      className="px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting || !newTitle.trim()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 disabled:opacity-50 text-white rounded-xl text-xs font-medium shadow-xs transition-all cursor-pointer"
                    >
                      {isSubmitting ? (
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
      </div>

      {/* Linked Docs List or Empty State */}
      {isLoading ? (
        <div className="flex items-center justify-center py-2 text-slate-400 text-xs">
          <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
          Loading linked docs...
        </div>
      ) : linkedDocs.length === 0 ? (
        <div
          onClick={handleOpenPopover}
          className="border border-dashed border-slate-300/80 dark:border-slate-700/80 hover:border-amber-400 dark:hover:border-amber-500/70 rounded-2xl p-3 bg-slate-50/40 dark:bg-slate-900/30 text-center cursor-pointer transition-colors"
        >
          <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">
            No documents linked yet. Click to link or create a note.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {linkedDocs.map((doc) => {
            const isUnlinkingThis = unlinkingId === doc.id;
            const projectStyles = doc.project
              ? getProjectColorStyles(doc.project.color)
              : null;

            return (
              <div
                key={doc.id}
                className="group flex items-center justify-between gap-2 p-2.5 rounded-xl border border-slate-200/70 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/60 hover:bg-white dark:hover:bg-slate-900 transition-all hover:shadow-2xs overflow-hidden"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <FileText className="w-3.5 h-3.5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <a
                      href={`/docs/${doc.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate block hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                      title={doc.title}
                    >
                      {doc.title || "Untitled Document"}
                    </a>
                    {doc.project && projectStyles && (
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] border mt-0.5 ${projectStyles.badgeClass}`}
                      >
                        <span
                          className={`w-1 h-1 rounded-full ${projectStyles.dotClass}`}
                        />
                        <span className="truncate max-w-[80px]">
                          {doc.project.name}
                        </span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions: Open in Docs page & Unlink */}
                <div className="flex items-center gap-1 shrink-0">
                  <a
                    href={`/docs/${doc.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 rounded-lg text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title="Open document in new tab"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  <button
                    type="button"
                    onClick={() => handleUnlinkDoc(doc.id)}
                    disabled={isUnlinkingThis}
                    className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer disabled:opacity-50"
                    title="Unlink document"
                  >
                    {isUnlinkingThis ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-500" />
                    ) : (
                      <X className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
