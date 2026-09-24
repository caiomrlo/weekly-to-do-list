"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { Workspace } from "@/db/schema";
import {
  switchWorkspaceAction,
  createWorkspaceAction,
  renameWorkspaceAction,
  deleteWorkspaceAction,
} from "@/app/actions/workspaces";
import {
  Briefcase,
  Check,
  ChevronDown,
  Pencil,
  Plus,
  Trash2,
  Loader2,
  ShieldAlert,
} from "lucide-react";

export interface WorkspaceSelectorProps {
  workspaces: Workspace[];
  activeWorkspaceId: string;
}

export function WorkspaceSelector({
  workspaces,
  activeWorkspaceId,
}: WorkspaceSelectorProps) {
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const [isOpen, setIsOpen] = useState(false);

  // Create Workspace state
  const [isCreating, setIsCreating] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [createError, setCreateError] = useState("");

  // Rename Workspace state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameError, setRenameError] = useState("");

  // Delete Confirmation state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");

  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setIsCreating(false);
        setEditingId(null);
        setDeletingId(null);
        setCreateError("");
        setRenameError("");
        setDeleteError("");
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const activeWorkspace =
    workspaces.find((w) => w.id === activeWorkspaceId) ||
    workspaces.find((w) => w.isDefault) ||
    workspaces[0];

  const handleSwitch = (workspaceId: string) => {
    if (workspaceId === activeWorkspaceId || isPending) return;

    setIsOpen(false);

    startTransition(async () => {
      const res = await switchWorkspaceAction(workspaceId);
      if (res.success) {
        if (pathname.startsWith("/docs/")) {
          window.location.replace(`${window.location.origin}/docs`);
        } else {
          window.location.reload();
        }
      }
    });
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newWorkspaceName.trim();
    if (!trimmed) {
      setCreateError("Workspace name is required.");
      return;
    }

    setCreateError("");
    startTransition(async () => {
      const res = await createWorkspaceAction({ name: trimmed });
      if (res.workspace) {
        setNewWorkspaceName("");
        setIsCreating(false);
        setIsOpen(false);

        if (pathname.startsWith("/docs/")) {
          window.location.replace(`${window.location.origin}/docs`);
        } else {
          window.location.reload();
        }
      } else if (res.error) {
        setCreateError(res.error);
      }
    });
  };

  const startRename = (ws: Workspace, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(ws.id);
    setRenameValue(ws.name);
    setRenameError("");
    setDeletingId(null);
  };

  const handleRenameSubmit = async (workspaceId: string, e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setRenameError("Workspace name is required.");
      return;
    }

    setRenameError("");
    startTransition(async () => {
      const res = await renameWorkspaceAction(workspaceId, trimmed);
      if (res.workspace) {
        setEditingId(null);
        window.location.reload();
      } else if (res.error) {
        setRenameError(res.error);
      }
    });
  };

  const startDelete = (ws: Workspace, e: React.MouseEvent) => {
    e.stopPropagation();
    if (ws.isDefault) return;
    setDeletingId(ws.id);
    setDeleteError("");
    setEditingId(null);
  };

  const handleDeleteConfirm = async (workspaceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteError("");

    startTransition(async () => {
      const res = await deleteWorkspaceAction(workspaceId);
      if (res.success) {
        setDeletingId(null);

        if (pathname.startsWith("/docs/")) {
          window.location.replace(`${window.location.origin}/docs`);
        } else {
          window.location.reload();
        }
      } else if (res.error) {
        setDeleteError(res.error);
      }
    });
  };

  return (
    <div className="relative" ref={popoverRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        disabled={isPending}
        className={`flex items-center gap-2.5 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-2xl border text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer select-none max-w-[190px] sm:max-w-[240px] shadow-xs ${
          isOpen
            ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300/80 dark:border-amber-700/80 ring-2 ring-amber-500/20"
            : "bg-white/90 hover:bg-white dark:bg-neutral-900/90 dark:hover:bg-neutral-850 text-slate-800 dark:text-neutral-100 border-slate-200/80 dark:border-neutral-700/80 hover:border-slate-300 dark:hover:border-neutral-600"
        }`}
        title={`Current Workspace: ${activeWorkspace?.name || "Workspace"}`}
        aria-label={`Current Workspace: ${activeWorkspace?.name || "Workspace"}`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <div className="w-5 h-5 rounded-lg bg-amber-500/10 dark:bg-amber-400/15 text-amber-500 dark:text-amber-400 flex items-center justify-center shrink-0">
          {isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Briefcase className="w-3.5 h-3.5" />
          )}
        </div>
        <span className="truncate flex-1 text-left">
          {activeWorkspace?.name || "My Workspace"}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 dark:text-neutral-500 transition-transform duration-200 shrink-0 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute left-0 mt-2 w-72 sm:w-80 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 shadow-2xl p-2 z-50 flex flex-col gap-1 animate-in fade-in zoom-in-95 duration-150">
          {/* Section Header */}
          <div className="flex items-center justify-between px-2.5 py-1.5 text-[11px] font-bold tracking-wider uppercase text-slate-400 dark:text-neutral-500">
            <span>Workspaces</span>
            {isPending && (
              <span className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-normal">
                <Loader2 className="w-3 h-3 animate-spin" /> Updating...
              </span>
            )}
          </div>

          {/* Workspaces List */}
          <div className="max-h-60 overflow-y-auto flex flex-col gap-1 pr-0.5">
            {workspaces.map((ws) => {
              const isActive = ws.id === activeWorkspaceId;
              const isEditing = editingId === ws.id;
              const isDeleting = deletingId === ws.id;

              if (isEditing) {
                return (
                  <form
                    key={ws.id}
                    onSubmit={(e) => handleRenameSubmit(ws.id, e)}
                    className="p-1.5 rounded-xl bg-slate-100/90 dark:bg-neutral-800/90 border border-amber-300 dark:border-amber-700 flex flex-col gap-1.5"
                  >
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      placeholder="Workspace name"
                      autoFocus
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-white dark:bg-neutral-900 border border-slate-300 dark:border-neutral-700 text-slate-800 dark:text-neutral-100 outline-none focus:ring-1 focus:ring-amber-500"
                    />
                    {renameError && (
                      <span className="text-[10px] text-rose-500 px-1">
                        {renameError}
                      </span>
                    )}
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null);
                          setRenameError("");
                        }}
                        className="px-2 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-md cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isPending}
                        className="px-2.5 py-1 text-[11px] font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-md shadow-xs cursor-pointer flex items-center gap-1"
                      >
                        {isPending && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
                        Save
                      </button>
                    </div>
                  </form>
                );
              }

              if (isDeleting) {
                return (
                  <div
                    key={ws.id}
                    className="p-2 rounded-xl bg-rose-50/90 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 flex flex-col gap-2"
                  >
                    <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 text-xs font-semibold">
                      <ShieldAlert className="w-4 h-4 shrink-0" />
                      <span>Delete &quot;{ws.name}&quot;?</span>
                    </div>
                    <p className="text-[11px] text-rose-500/90 dark:text-rose-400/90">
                      All tasks, projects, tags, and docs in this workspace will be permanently deleted.
                    </p>
                    {deleteError && (
                      <span className="text-[10px] text-rose-600 dark:text-rose-400 font-medium">
                        {deleteError}
                      </span>
                    )}
                    <div className="flex items-center justify-end gap-1.5 pt-0.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingId(null);
                          setDeleteError("");
                        }}
                        className="px-2 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-md cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteConfirm(ws.id, e)}
                        disabled={isPending}
                        className="px-2.5 py-1 text-[11px] font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-md shadow-xs cursor-pointer flex items-center gap-1"
                      >
                        {isPending && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
                        Delete
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={ws.id}
                  onClick={() => handleSwitch(ws.id)}
                  className={`group flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition-all cursor-pointer ${
                    isActive
                      ? "bg-amber-500/10 dark:bg-amber-400/15 text-amber-900 dark:text-amber-200 font-semibold"
                      : "hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-medium"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                    <div
                      className={`w-4 h-4 flex items-center justify-center shrink-0 ${
                        isActive
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-transparent"
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <span className="truncate">{ws.name}</span>
                    {ws.isDefault && (
                      <span className="text-[10px] font-medium px-1.5 py-0.2 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 shrink-0">
                        Default
                      </span>
                    )}
                  </div>

                  {/* Actions (Rename & Delete) */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => startRename(ws, e)}
                      className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                      title="Rename workspace"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>

                    {!ws.isDefault && (
                      <button
                        type="button"
                        onClick={(e) => startDelete(ws, e)}
                        className="p-1 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-950/50 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                        title="Delete workspace"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Divider */}
          <div className="h-px bg-slate-200/80 dark:bg-neutral-800/80 my-1" />

          {/* Creation Form / Action */}
          {isCreating ? (
            <form
              onSubmit={handleCreateSubmit}
              className="p-1.5 rounded-xl bg-slate-100/90 dark:bg-neutral-800/90 border border-amber-300 dark:border-amber-700 flex flex-col gap-1.5"
            >
              <input
                type="text"
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                placeholder="Workspace name..."
                autoFocus
                className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-white dark:bg-neutral-900 border border-slate-300 dark:border-neutral-700 text-slate-800 dark:text-neutral-100 outline-none focus:ring-1 focus:ring-amber-500"
              />
              {createError && (
                <span className="text-[10px] text-rose-500 px-1">
                  {createError}
                </span>
              )}
              <div className="flex items-center justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreating(false);
                    setCreateError("");
                  }}
                  className="px-2 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-md cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-2.5 py-1 text-[11px] font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-md shadow-xs cursor-pointer flex items-center gap-1"
                >
                  {isPending && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
                  Create
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setIsCreating(true)}
              className="flex items-center gap-2 w-full px-2.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 rounded-xl hover:bg-amber-500/10 dark:hover:bg-amber-400/10 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-amber-500" />
              <span>New Workspace</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
