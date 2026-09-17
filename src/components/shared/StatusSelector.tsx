"use client";

import { useEffect, useRef, useState } from "react";
import { TaskStatus } from "@/db/schema";
import { getStatusStyles } from "@/lib/status-utils";
import { ChevronDown, Check } from "lucide-react";

export interface StatusSelectorProps {
  selectedStatus: TaskStatus | null;
  statuses: TaskStatus[];
  onSelectStatus: (status: TaskStatus) => void;
}

export function StatusSelector({
  selectedStatus,
  statuses,
  onSelectStatus,
}: StatusSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const currentStyles = getStatusStyles(selectedStatus?.color);

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium bg-slate-100/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 border border-slate-200/70 dark:border-slate-700/70 transition-all shadow-2xs cursor-pointer"
        title="Change status"
      >
        <span className={`w-2 h-2 rounded-full ${currentStyles.dotClass}`} />
        <span>{selectedStatus?.name || "To Do"}</span>
        <ChevronDown className="w-3 h-3 text-slate-400 dark:text-slate-500 ml-0.5" />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-44 rounded-2xl bg-white dark:bg-slate-900 shadow-xl border border-slate-200 dark:border-slate-800 p-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="px-2 py-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
            Status
          </div>
          <div className="space-y-0.5 max-h-56 overflow-y-auto custom-scrollbar">
            {statuses.map((status) => {
              const styles = getStatusStyles(status.color);
              const isSelected = selectedStatus?.id === status.id;

              return (
                <button
                  key={status.id}
                  type="button"
                  onClick={() => {
                    onSelectStatus(status);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  }`}
                >
                  <span className="flex items-center gap-2 truncate">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${styles.dotClass}`} />
                    <span className="truncate">{status.name}</span>
                  </span>
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 ml-1.5" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}