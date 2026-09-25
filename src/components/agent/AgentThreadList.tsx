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
  onToggleOpen: () => void;
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
  onToggleOpen,
  isCreating,
}: AgentThreadListProps) {
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const filteredThreads = threads.filter((t) =>
    t.title.toLowerCase().includes(search.toLowerCase())
  );

  const startRename = (thread: AiThread, e: React.MouseEvent) => {
    e.stopPropagation();
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

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs md:hidden"
          onClick={onToggleOpen}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 flex flex-col w-72 sm:w-80 shrink-0 bg-white dark:bg-neutral-900 border-r border-slate-200 dark:border-neutral-800 transition-transform duration-300 ease-in-out md:translate-x-0 ${
          isOpen ? "translate-x-0 shadow-xl md:shadow-none" : "-translate-x-full md:w-0 md:overflow-hidden md:border-r-0"
        }`}
      >
        {/* Header Actions */}
        <div className="p-3.5 border-b border-slate-200/80 dark:border-neutral-800/80 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="truncate">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                AI Conversations
              </h2>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {threads.length} {threads.length === 1 ? "chat" : "chats"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onCreateThread}
              disabled={isCreating}
              className="p-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white shadow-xs transition-colors cursor-pointer flex items-center justify-center group disabled:opacity-50"
              title="New Conversation"
              aria-label="New Conversation"
            >
              <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform duration-200" />
            </button>

            <button
              type="button"
              onClick={onToggleOpen}
              className="p-1.5 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              title="Close sidebar"
              aria-label="Close sidebar"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search filter */}
        <div className="p-3 border-b border-slate-200/60 dark:border-neutral-800/60">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs bg-slate-100/80 dark:bg-neutral-800/80 border border-slate-200/80 dark:border-neutral-700/80 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-amber-500 transition-all"
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
                  onClick={onCreateThread}
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-950/60 transition-colors cursor-pointer"
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

              return (
                <div
                  key={thread.id}
                  onClick={() => !isEditing && onSelectThread(thread.id)}
                  className={`group relative flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer select-none ${
                    isActive
                      ? "bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 font-medium border border-amber-200/60 dark:border-amber-800/60 shadow-2xs"
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-neutral-800/70 border border-transparent"
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
                          className="p-1 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                          title="Save"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={cancelRename}
                          className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
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
                        className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-neutral-700/60 transition-colors"
                        title="Rename conversation"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (
                            confirm("Are you sure you want to delete this conversation?")
                          ) {
                            onDeleteThread(thread.id);
                          }
                        }}
                        className="p-1 rounded-md text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
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
