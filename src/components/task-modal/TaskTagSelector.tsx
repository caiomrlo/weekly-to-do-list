"use client";

import { useEffect, useRef, useState } from "react";
import { Tag } from "@/db/schema";
import { createTagAction } from "@/app/actions/tags";
import { TAG_COLORS, getTagColorStyles } from "@/lib/tag-utils";
import { Tag as TagIcon, Plus, ChevronDown, Check, X, Loader2 } from "lucide-react";

interface TaskTagSelectorProps {
  selectedTag: Tag | null;
  userTags: Tag[];
  onSelectTag: (tag: Tag | null) => void;
  onTagCreated: (tag: Tag) => void;
}

export function TaskTagSelector({
  selectedTag,
  userTags,
  onSelectTag,
  onTagCreated,
}: TaskTagSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("amber");
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
    const trimmed = newTagName.trim();
    if (!trimmed) {
      setError("Tag name is required.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const res = await createTagAction({
        name: trimmed,
        color: newTagColor,
      });

      if (res.tag) {
        onTagCreated(res.tag);
        onSelectTag(res.tag);
        setNewTagName("");
        setIsCreating(false);
        setIsOpen(false);
      } else if (res.error) {
        setError(res.error);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to create tag.");
    } finally {
      setIsLoading(false);
    }
  };

  const selectedTagStyles = selectedTag
    ? getTagColorStyles(selectedTag.color)
    : null;

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex items-center gap-2">
        <TagIcon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />

        {selectedTag ? (
          <div className="inline-flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setIsOpen((prev) => !prev);
                setIsCreating(false);
                setError("");
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium border shadow-2xs hover:opacity-90 transition-all cursor-pointer ${
                selectedTagStyles?.badgeClass ||
                "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/60"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  selectedTagStyles?.dotClass || "bg-amber-500"
                }`}
              />
              <span>{selectedTag.name}</span>
              <ChevronDown className="w-3 h-3 opacity-60 ml-0.5" />
            </button>
            <button
              type="button"
              onClick={() => onSelectTag(null)}
              className="text-slate-400 hover:text-rose-500 p-0.5 rounded-md transition-colors cursor-pointer"
              title="Remove tag"
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
            className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 font-medium py-1 px-1.5 rounded-lg hover:bg-slate-100/70 dark:hover:bg-slate-800/70 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add tag</span>
          </button>
        )}
      </div>

      {/* Popover */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-2 w-72 sm:w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-3 z-30 animate-in fade-in zoom-in-95 duration-150">
          {!isCreating ? (
            <div>
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300">
                <span>Select Tag</span>
                <button
                  type="button"
                  onClick={() => setIsCreating(true)}
                  className="inline-flex items-center gap-1 text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 font-medium cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Tag
                </button>
              </div>

              {/* Tag list */}
              <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                {selectedTag && (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectTag(null);
                      setIsOpen(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <span>None (Remove tag)</span>
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}

                {userTags.length === 0 ? (
                  <div className="py-4 text-center text-xs text-slate-400 dark:text-slate-500">
                    No tags created yet.
                  </div>
                ) : (
                  userTags.map((tag) => {
                    const styles = getTagColorStyles(tag.color);
                    const isSelected = selectedTag?.id === tag.id;

                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => {
                          onSelectTag(tag);
                          setIsOpen(false);
                        }}
                        className={`w-full text-left px-2.5 py-2 rounded-xl text-xs font-medium flex items-center justify-between transition-all cursor-pointer ${
                          isSelected
                            ? `${styles.badgeClass} ring-1 ring-amber-400/40 font-semibold`
                            : "hover:bg-slate-100/80 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-200"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${styles.dotClass}`}
                          />
                          <span>{tag.name}</span>
                        </span>
                        {isSelected && (
                          <Check className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            /* Inline Tag Creation Form */
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200">
                <span>Create New Tag</span>
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
                <div className="text-[11px] text-rose-600 dark:text-rose-400 font-medium bg-rose-50 dark:bg-rose-950/60 p-2 rounded-lg">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  Tag Name
                </label>
                <input
                  type="text"
                  autoFocus
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="e.g. Work, Study, Personal..."
                  maxLength={50}
                  className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                  Tag Color
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {Object.values(TAG_COLORS).map((colorOpt) => (
                    <button
                      key={colorOpt.key}
                      type="button"
                      onClick={() => setNewTagColor(colorOpt.key)}
                      className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-[10px] font-medium transition-all cursor-pointer ${
                        newTagColor === colorOpt.key
                          ? `${colorOpt.badgeClass} ring-2 ring-amber-500/30 font-bold border-amber-400`
                          : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${colorOpt.dotClass}`}
                      />
                      <span className="truncate">{colorOpt.label}</span>
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
                  className="px-2.5 py-1 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isLoading || !newTagName.trim()}
                  className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {isLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                  Save Tag
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
