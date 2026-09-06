"use client";

import { useEffect, useRef, useState } from "react";
import { UserPreferences } from "@/db/schema";
import { SlidersHorizontal } from "lucide-react";

interface ViewSettingsMenuProps {
  preferences: UserPreferences;
  visibleDaysCount: number;
  onToggleDay: (dayKey: "showSaturday" | "showSunday") => void;
}

export function ViewSettingsMenu({
  preferences,
  visibleDaysCount,
  onToggleDay,
}: ViewSettingsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close view menu on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const hasCustomDays = preferences.showSaturday || preferences.showSunday;

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium shadow-xs transition-all cursor-pointer ${
          isOpen || hasCustomDays
            ? "bg-indigo-50/90 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border-indigo-200/80 dark:border-indigo-800/80"
            : "bg-white/70 hover:bg-white dark:bg-slate-800/70 dark:hover:bg-slate-800 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white border-slate-200/70 dark:border-slate-700/70"
        }`}
        title="Ajustes de visualização dos dias"
        aria-label="Ajustes de visualização dos dias"
      >
        <SlidersHorizontal className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Visualização</span>
        {hasCustomDays && (
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 p-3 rounded-2xl glass-panel shadow-xl border border-white/80 dark:border-slate-700/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="pb-2 mb-2 border-b border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
              Dias da Semana
            </p>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
              {visibleDaysCount} de 7 dias
            </span>
          </div>

          <div className="space-y-1.5">
            {/* Seg a Sex indicator */}
            <div className="px-2 py-1.5 text-[11px] text-slate-500 dark:text-slate-400 bg-slate-100/60 dark:bg-slate-800/60 rounded-lg flex items-center justify-between">
              <span>Segunda – Sexta</span>
              <span className="font-semibold text-slate-400 dark:text-slate-500 text-[10px]">
                Padrão
              </span>
            </div>

            {/* Sábado Switch */}
            <button
              type="button"
              onClick={() => onToggleDay("showSaturday")}
              className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-100/70 dark:hover:bg-slate-800/70 cursor-pointer transition-colors text-left"
            >
              <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                Sábado
              </span>
              <div
                className={`w-8 h-[18px] flex items-center rounded-full p-0.5 transition-colors duration-200 ease-in-out ${
                  preferences.showSaturday
                    ? "bg-indigo-600"
                    : "bg-slate-300 dark:bg-slate-700"
                }`}
              >
                <div
                  className={`bg-white w-3.5 h-3.5 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                    preferences.showSaturday
                      ? "translate-x-3.5"
                      : "translate-x-0"
                  }`}
                />
              </div>
            </button>

            {/* Domingo Switch */}
            <button
              type="button"
              onClick={() => onToggleDay("showSunday")}
              className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-100/70 dark:hover:bg-slate-800/70 cursor-pointer transition-colors text-left"
            >
              <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                Domingo
              </span>
              <div
                className={`w-8 h-[18px] flex items-center rounded-full p-0.5 transition-colors duration-200 ease-in-out ${
                  preferences.showSunday
                    ? "bg-indigo-600"
                    : "bg-slate-300 dark:bg-slate-700"
                }`}
              >
                <div
                  className={`bg-white w-3.5 h-3.5 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                    preferences.showSunday
                      ? "translate-x-3.5"
                      : "translate-x-0"
                  }`}
                />
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
