"use client";

import { useState, useEffect, useRef } from "react";
import { TaskStatus, TaskStatusCategory } from "@/db/schema";
import {
  STATUS_COLORS,
  getStatusStyles,
} from "@/lib/status-utils";
import { X, Trash2, Loader2, Check } from "lucide-react";

export interface StatusConfigModalProps {
  isOpen: boolean;
  mode: "create" | "edit";
  status?: TaskStatus | null;
  onClose: () => void;
  onSave: (data: {
    name: string;
    color: string;
    category?: TaskStatusCategory;
  }) => Promise<void>;
  onDelete?: (statusId: string) => Promise<void>;
}

export function StatusConfigModal(props: StatusConfigModalProps) {
  if (!props.isOpen) return null;
  return (
    <StatusConfigModalContent
      key={props.mode === "edit" && props.status ? props.status.id : "create"}
      {...props}
    />
  );
}

function StatusConfigModalContent({
  mode,
  status,
  onClose,
  onSave,
  onDelete,
}: StatusConfigModalProps) {
  const [name, setName] = useState(mode === "edit" && status ? status.name : "");
  const [color, setColor] = useState(mode === "edit" && status ? status.color || "slate" : "slate");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");

  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Status name is required.");
      return;
    }
    if (trimmed.length > 50) {
      setError("Status name must be 50 characters or less.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      await onSave({
        name: trimmed,
        color,
        category: status?.category || "doing",
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save status.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!status || !onDelete) return;
    if (status.isDefault) {
      setError("Default statuses cannot be deleted.");
      return;
    }

    setIsDeleting(true);
    setError("");

    try {
      await onDelete(status.id);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete status.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        ref={modalRef}
        className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 animate-in zoom-in-95 duration-150"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 tracking-tight">
            {mode === "create" ? "New Status Column" : "Edit Status"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. In Review"
              autoFocus
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition-all"
            />
          </div>


          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Color
            </label>
            <div className="flex flex-wrap gap-2">
              {Object.keys(STATUS_COLORS).map((colorKey) => {
                const styles = getStatusStyles(colorKey);
                const isSelected = color === colorKey;

                return (
                  <button
                    key={colorKey}
                    type="button"
                    onClick={() => setColor(colorKey)}
                    className={`w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                      styles.dotClass
                    } ${
                      isSelected
                        ? "ring-2 ring-offset-2 ring-slate-800 dark:ring-white scale-110"
                        : "opacity-80 hover:opacity-100 hover:scale-105"
                    }`}
                    title={styles.label}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-800">
            {mode === "edit" && !status?.isDefault && onDelete ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting || isSubmitting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isDeleting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>Delete</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || isDeleting}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white shadow-xs shadow-amber-500/20 transition-all disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{mode === "create" ? "Create Column" : "Save Changes"}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}