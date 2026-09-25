"use client";

import { useState } from "react";
import { AiThread } from "@/db/schema";
import {
  MessageSquare,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  Search,
  Bot,
  PanelLeftClose,
} from "lucide-react";

interface AgentThreadListProps {
  threads: AiThread[];
  activeThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  onCreateThread: () => void;
  onDeleteThread: (threadId: string) => void;
  onRenameThread: (threadId: string, newTitle: string) => void;
  isOpen: boolean;
  isMobileOpen?: boolean;
  onToggleOpen: () => void;
  onToggleMobileOpen?: () => void;
  isCreating?: boolean;
}

export function AgentThreadList({
  threads,
  activeThreadId,
  onSelectThread,
  onCreateThread,
  onDeleteThread,
  onRenameThread,
  isOpen,
  isMobileOpen = false,
  onToggleOpen,
  onToggleMobileOpen,
  isCreating,
}: AgentThreadListProps) {
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredThreads = threads.filter((t) =>
    t.title.toLowerCase().includes(search.toLowerCase())
  );

  const startRename = (thread: AiThread, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingId(null);
    setEditingId(thread.id);
    setEditingTitle(thread.title);
  };

  const saveRename = (threadId: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (editingTitle.trim()) {
      onRenameThread(threadId, editingTitle.trim());
    }
    setEditingId(null);
  };

  const cancelRename = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingId(null);
  };

  const handleSelectThread = (threadId: string) => {
    setDeletingId(null);
    onSelectThread(threadId);
    if (isMobileOpen && onToggleMobileOpen) {
      onToggleMobileOpen();
    }
  };

  const handleCreateThread = () => {
    setDeletingId(null);
    onCreateThread();
    if (isMobileOpen && onToggleMobileOpen) {
      onToggleMobileOpen();
    }
  };

  const handleCloseSidebar = () => {
    if (isMobileOpen && onToggleMobileOpen) {
      onToggleMobileOpen();
    } else {
      onToggleOpen();
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs md:hidden"
          onClick={onToggleMobileOpen ?? onToggleOpen}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container: Consistent 256px width, clean glass transparency */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 flex flex-col w-64 shrink-0 transition-all duration-300 ease-in-out md:translate-x-0 ${
          isMobileOpen
            ? "translate-x-0 shadow-xl md:shadow-none bg-white/95 dark:bg-neutral-900/95 md:bg-white/35 md:dark:bg-neutral-900/35 backdrop-blur-md md:backdrop-blur-xs border-r border-slate-200/60 dark:border-neutral-800/60"
            : "-translate-x-full md:translate-x-0 bg-white/35 dark:bg-neutral-900/35 backdrop-blur-xs border-r border-slate-200/60 dark:border-neutral-800/60"
        } ${
          isOpen
            ? "md:w-64 md:opacity-100"
            : "md:w-0 md:overflow-hidden md:border-r-0 md:opacity-0"
        }`}
      >
        {/* Header Actions */}
        <div className="p-3 sm:p-3.5 border-b border-slate-200/60 dark:border-neutral-800/60 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="truncate min-w-0">
              <h2 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                AI Conversations
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleCreateThread}
              disabled={isCreating}
              className="p-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white shadow-xs transition-colors cursor-pointer flex items-center justify-center group disabled:opacity-50"
              title="New Conversation"
              aria-label="New Conversation"
            >
              <Plus className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform duration-200" />
            </button>

            <button
              type="button"
              onClick={handleCloseSidebar}
              className="p-1.5 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-white/60 dark:hover:bg-neutral-800/60 transition-colors cursor-pointer"
              title="Close sidebar"
              aria-label="Close sidebar"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search filter */}
        <div className="p-2.5 sm:p-3 border-b border-slate-200/50 dark:border-neutral-800/50 shrink-0">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs bg-white/60 dark:bg-neutral-800/50 border border-slate-200/70 dark:border-neutral-700/60 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-amber-500 transition-all"
            />
          </div>
        </div>

        {/* Thread List Items */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin">
          {filteredThreads.length === 0 ? (
            <div className="py-8 px-4 text-center">
              <MessageSquare className="w-7 h-7 mx-auto text-slate-300 dark:text-neutral-600 mb-2" />
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {search ? "No chats found." : "No conversations yet."}
              </p>
              {!search && (
                <button
                  type="button"
                  onClick={handleCreateThread}
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Start new chat</span>
                </button>
              )}
            </div>
          ) : (
            filteredThreads.map((thread) => {
              const isActive = thread.id === activeThreadId;
              const isEditing = editingId === thread.id;
              const isDeleting = deletingId === thread.id;

              if (isDeleting) {
                return (
                  <div
                    key={thread.id}
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center justify-between gap-1.5 px-2.5 h-9 rounded-xl text-xs bg-rose-50/90 dark:bg-rose-950/60 border border-rose-200/90 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 shrink-0 select-none animate-in fade-in duration-150"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                      <span className="truncate font-medium text-xs">Delete?</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteThread(thread.id);
                          setDeletingId(null);
                        }}
                        className="px-2 py-0.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-medium text-[11px] transition-colors cursor-pointer shadow-2xs"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingId(null)}
                        className="px-1.5 py-0.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-rose-100/60 dark:hover:bg-rose-900/40 text-[11px] transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={thread.id}
                  onClick={() => !isEditing && handleSelectThread(thread.id)}
                  className={`group relative flex items-center justify-between gap-1.5 px-2.5 h-9 rounded-xl text-xs transition-colors cursor-pointer select-none shrink-0 ${
                    isActive
                      ? "bg-amber-500/15 dark:bg-amber-400/15 text-amber-900 dark:text-amber-200 font-medium border border-amber-500/20 dark:border-amber-400/20 shadow-2xs"
                      : "text-slate-700 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-neutral-800/60 border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <MessageSquare
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isActive
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300"
                      }`}
                    />

                    {isEditing ? (
                      <form
                        onSubmit={(e) => saveRename(thread.id, e)}
                        className="flex items-center gap-1 flex-1 min-w-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="text"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          autoFocus
                          className="flex-1 min-w-0 px-1.5 py-0.5 text-xs bg-white dark:bg-neutral-800 border border-amber-500 rounded-md text-slate-900 dark:text-slate-100 focus:outline-hidden"
                        />
                        <button
                          type="submit"
                          className="p-1 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 cursor-pointer"
                          title="Save"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={cancelRename}
                          className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                          title="Cancel"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </form>
                    ) : (
                      <span className="truncate flex-1">{thread.title}</span>
                    )}
                  </div>

                  {!isEditing && (
                    <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => startRename(thread, e)}
                        className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-neutral-700/60 transition-colors cursor-pointer"
                        title="Rename conversation"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingId(thread.id);
                          setEditingId(null);
                        }}
                        className="p-1 rounded-md text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                        title="Delete conversation"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </aside>
    </>
  );
}
