"use client";

import { useState, useMemo } from "react";
import { DocWithRelations, Project } from "@/db/schema";
import { getProjectColorStyles } from "@/lib/project-utils";
import {
  Search,
  Plus,
  Star,
  FileText,
  Link2,
  Paperclip,
  Trash2,
  X,
  Filter,
} from "lucide-react";

interface DocsSidebarProps {
  docs: DocWithRelations[];
  selectedDocId: string | null;
  userProjects: Project[];
  onSelectDoc: (doc: DocWithRelations) => void;
  onCreateDoc: () => void;
  onDeleteDoc: (docId: string) => void;
  onToggleFavorite: (docId: string, isFav: boolean) => void;
}

export function DocsSidebar({
  docs,
  selectedDocId,
  userProjects,
  onSelectDoc,
  onCreateDoc,
  onDeleteDoc,
  onToggleFavorite,
}: DocsSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterFavorite, setFilterFavorite] = useState(false);
  const [filterProjectId, setFilterProjectId] = useState<string | null>(null);
  const [confirmingDeleteDocId, setConfirmingDeleteDocId] = useState<string | null>(null);

  // Filter docs
  const filteredDocs = useMemo(() => {
    return docs.filter((doc) => {
      if (filterFavorite && !doc.isFavorite) return false;
      if (filterProjectId && doc.projectId !== filterProjectId) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = doc.title.toLowerCase().includes(query);
        const matchesContent = doc.content?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesContent) return false;
      }
      return true;
    });
  }, [docs, filterFavorite, filterProjectId, searchQuery]);

  return (
    <div className="w-full lg:w-80 xl:w-96 flex flex-col h-full border-r border-slate-200/60 dark:border-neutral-800/80 bg-slate-50/40 dark:bg-neutral-900/30">
      {/* Search & Actions Header */}
      <div className="p-4 space-y-3 border-b border-slate-200/60 dark:border-neutral-800/80">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onCreateDoc}
            className="w-full flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-xs font-semibold shadow-sm shadow-amber-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Document</span>
          </button>
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents..."
            className="w-full pl-9 pr-7 py-1.5 rounded-xl text-xs bg-white/80 dark:bg-neutral-800/80 border border-slate-200/80 dark:border-neutral-700/80 text-slate-800 dark:text-neutral-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            type="button"
            onClick={() => {
              setFilterFavorite(false);
              setFilterProjectId(null);
            }}
            className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer shrink-0 ${
              !filterFavorite && !filterProjectId
                ? "bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 font-semibold"
                : "text-slate-500 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
            }`}
          >
            All ({docs.length})
          </button>

          <button
            type="button"
            onClick={() => setFilterFavorite((prev) => !prev)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer shrink-0 ${
              filterFavorite
                ? "bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 font-semibold"
                : "text-slate-500 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
            }`}
          >
            <Star
              className={`w-3 h-3 ${
                filterFavorite ? "fill-amber-400 text-amber-500" : ""
              }`}
            />
            <span>Favorites</span>
          </button>

          {userProjects.length > 0 && (
            <div className="relative inline-flex items-center shrink-0">
              <select
                value={filterProjectId || ""}
                onChange={(e) => setFilterProjectId(e.target.value || null)}
                className="appearance-none text-xs pl-2 pr-6 py-1 rounded-lg bg-transparent text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 cursor-pointer focus:outline-none"
              >
                <option value="">Projects...</option>
                {userProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <Filter className="w-2.5 h-2.5 absolute right-1.5 text-slate-400 pointer-events-none" />
            </div>
          )}
        </div>
      </div>

      {/* Documents List */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
        {filteredDocs.length === 0 ? (
          <div className="py-12 px-4 text-center text-slate-400 dark:text-slate-500 space-y-2">
            <FileText className="w-8 h-8 mx-auto opacity-50" />
            <p className="text-xs font-medium">No documents found.</p>
            <button
              type="button"
              onClick={onCreateDoc}
              className="text-xs text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
            >
              Create your first document
            </button>
          </div>
        ) : (
          filteredDocs.map((doc) => {
            const isSelected = selectedDocId === doc.id;
            const projectStyles = doc.project
              ? getProjectColorStyles(doc.project.color)
              : null;

            return (
              <div
                key={doc.id}
                onClick={() => onSelectDoc(doc)}
                className={`group relative p-3 rounded-2xl border transition-all cursor-pointer select-none ${
                  isSelected
                    ? "bg-white dark:bg-neutral-800/90 border-amber-500/40 shadow-sm ring-1 ring-amber-500/20"
                    : "bg-white/60 dark:bg-neutral-900/50 border-slate-200/60 dark:border-neutral-800/70 hover:bg-white dark:hover:bg-neutral-800/70 hover:shadow-2xs"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3
                      className={`text-xs font-semibold truncate ${
                        isSelected
                          ? "text-amber-800 dark:text-amber-300"
                          : "text-slate-800 dark:text-slate-200"
                      }`}
                    >
                      {doc.title || "Untitled Document"}
                    </h3>

                    {/* Metadata chips */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      {doc.project && projectStyles && (
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md text-[10px] font-medium border ${projectStyles.badgeClass}`}
                        >
                          <span
                            className={`w-1 h-1 rounded-full ${projectStyles.dotClass}`}
                          />
                          <span className="truncate max-w-[90px]">
                            {doc.project.name}
                          </span>
                        </span>
                      )}

                      {(doc.taskCount ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md text-[10px] font-medium bg-slate-100 dark:bg-neutral-800 text-slate-500 dark:text-slate-400">
                          <Link2 className="w-2.5 h-2.5" />
                          <span>{doc.taskCount}</span>
                        </span>
                      )}

                      {(doc.attachmentCount ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md text-[10px] font-medium bg-slate-100 dark:bg-neutral-800 text-slate-500 dark:text-slate-400">
                          <Paperclip className="w-2.5 h-2.5" />
                          <span>{doc.attachmentCount}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions: Favorite Toggle & Delete */}
                  {confirmingDeleteDocId === doc.id ? (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 bg-rose-50/95 dark:bg-rose-950/80 border border-rose-200/80 dark:border-rose-900/80 px-2 py-1 rounded-xl text-xs animate-in fade-in duration-150 shadow-2xs"
                    >
                      <span className="text-rose-700 dark:text-rose-300 font-medium text-[11px]">
                        Delete?
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteDoc(doc.id);
                          setConfirmingDeleteDocId(null);
                        }}
                        className="px-1.5 py-0.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-md transition-colors cursor-pointer text-[11px]"
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmingDeleteDocId(null);
                        }}
                        className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded transition-colors cursor-pointer"
                        title="Cancel"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFavorite(doc.id, !doc.isFavorite);
                        }}
                        className="p-1 text-slate-400 hover:text-amber-500 rounded-md transition-colors cursor-pointer"
                        title={
                          doc.isFavorite
                            ? "Remove from favorites"
                            : "Add to favorites"
                        }
                      >
                        <Star
                          className={`w-3.5 h-3.5 ${
                            doc.isFavorite
                              ? "fill-amber-400 text-amber-500"
                              : "opacity-40 group-hover:opacity-100"
                          }`}
                        />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmingDeleteDocId(doc.id);
                        }}
                        className="p-1 text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 rounded-md transition-opacity cursor-pointer"
                        title="Delete document"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
