"use client";

import { useEffect, useRef, useState } from "react";
import { BackgroundThemeId, UserPreferences } from "@/db/schema";
import { Settings, Check } from "lucide-react";

interface BackgroundOption {
  id: BackgroundThemeId;
  label: string;
  gradientClass: string;
}

const BACKGROUND_OPTIONS: BackgroundOption[] = [
  {
    id: "default",
    label: "Default",
    gradientClass:
      "from-amber-200 via-orange-100 to-amber-50 dark:from-slate-700 dark:via-slate-800 dark:to-slate-900",
  },
  {
    id: "sunset",
    label: "Sunset",
    gradientClass:
      "from-rose-300 via-orange-200 to-amber-100 dark:from-rose-900 dark:via-orange-950 dark:to-pink-950",
  },
  {
    id: "ocean",
    label: "Ocean",
    gradientClass:
      "from-sky-300 via-blue-200 to-cyan-100 dark:from-cyan-900 dark:via-blue-950 dark:to-indigo-950",
  },
  {
    id: "aurora",
    label: "Aurora",
    gradientClass:
      "from-emerald-300 via-teal-200 to-green-100 dark:from-emerald-900 dark:via-teal-950 dark:to-cyan-950",
  },
  {
    id: "lavender",
    label: "Lavender",
    gradientClass:
      "from-purple-300 via-violet-200 to-fuchsia-100 dark:from-purple-900 dark:via-fuchsia-950 dark:to-violet-950",
  },
  {
    id: "slate",
    label: "Slate",
    gradientClass:
      "from-slate-300 via-zinc-200 to-slate-100 dark:from-slate-700 dark:via-zinc-800 dark:to-neutral-900",
  },
];

export interface SettingsMenuProps {
  preferences: UserPreferences;
  visibleDaysCount?: number;
  onToggleDay?: (dayKey: "showSaturday" | "showSunday") => void;
  onSelectBackground: (bgId: BackgroundThemeId) => void;
}

export function SettingsMenu({
  preferences,
  visibleDaysCount,
  onToggleDay,
  onSelectBackground,
}: SettingsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const calculatedDaysCount =
    visibleDaysCount ??
    (5 + (preferences.showSaturday ? 1 : 0) + (preferences.showSunday ? 1 : 0));

  // Close settings menu on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
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

  const hasCustomDays =
    Boolean(onToggleDay) && (preferences.showSaturday || preferences.showSunday);
  const hasCustomBg = preferences.background && preferences.background !== "default";
  const hasCustomSettings = hasCustomDays || hasCustomBg;
  const activeBg = (preferences.background as BackgroundThemeId) || "default";

  return (
    <div className="relative" ref={menuRef}>
      {/* Trigger Button - Clean Icon-Only per specs */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`p-2 rounded-xl border text-xs font-medium shadow-xs transition-all cursor-pointer flex items-center justify-center relative ${
          isOpen || hasCustomSettings
            ? "bg-amber-50/90 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border-amber-200/80 dark:border-amber-800/80"
            : "bg-white/70 hover:bg-white dark:bg-neutral-800/70 dark:hover:bg-neutral-800 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white border-slate-200/70 dark:border-neutral-700/70"
        }`}
        title="Settings"
        aria-label="Settings"
      >
        <Settings className={`w-4 h-4 transition-transform duration-200 ${isOpen ? "rotate-45" : ""}`} />
        {hasCustomSettings && (
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400" />
        )}
      </button>

      {/* Settings Popover */}
      {isOpen && (
        <div className="fixed inset-x-3.5 top-16 sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80 max-h-[calc(100dvh-5rem)] sm:max-h-none overflow-y-auto sm:overflow-visible p-3.5 rounded-2xl bg-white dark:bg-neutral-900 shadow-2xl border border-slate-200 dark:border-neutral-800 z-50 animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="pb-2.5 mb-3 border-b border-slate-200/60 dark:border-neutral-800/60 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 dark:text-neutral-100 uppercase tracking-wider">
              Settings
            </h3>
            {hasCustomSettings && (
              <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-200/50 dark:border-amber-800/50">
                Customized
              </span>
            )}
          </div>

          {/* Section 1: Background Color / Gradient */}
          <div className={onToggleDay ? "mb-3.5" : ""}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Background
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 capitalize">
                {activeBg}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {BACKGROUND_OPTIONS.map((opt) => {
                const isSelected = activeBg === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onSelectBackground(opt.id)}
                    className={`group relative flex flex-col items-center gap-1.5 p-2 rounded-xl border text-center transition-all cursor-pointer ${
                      isSelected
                        ? "bg-amber-50/70 dark:bg-amber-950/40 border-amber-500/80 dark:border-amber-400/80 shadow-xs"
                        : "bg-slate-50/70 hover:bg-slate-100/80 dark:bg-neutral-800/40 dark:hover:bg-neutral-800/70 border-slate-200/70 dark:border-neutral-700/60"
                    }`}
                    title={`Select ${opt.label} background`}
                  >
                    {/* Gradient Preview Swatch */}
                    <div
                      className={`w-7 h-7 rounded-full bg-gradient-to-tr ${opt.gradientClass} shadow-xs border border-white/60 dark:border-neutral-700/60 flex items-center justify-center transition-transform group-hover:scale-105`}
                    >
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-amber-700 dark:text-amber-300 stroke-[2.5]" />
                      )}
                    </div>
                    <span
                      className={`text-[11px] leading-tight font-medium ${
                        isSelected
                          ? "text-amber-900 dark:text-amber-200 font-semibold"
                          : "text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      {opt.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Days of the Week (Only rendered when planner day controls are provided) */}
          {onToggleDay && (
            <div className="pt-3 border-t border-slate-200/60 dark:border-neutral-800/60">
              <div className="pb-2 mb-1 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Days of the Week
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                  {calculatedDaysCount} of 7 days
                </span>
              </div>

              <div className="space-y-1">
                {/* Mon to Fri indicator */}
                <div className="px-2 py-1.5 text-[11px] text-slate-500 dark:text-slate-400 bg-slate-100/60 dark:bg-neutral-800/60 rounded-lg flex items-center justify-between">
                  <span>Monday – Friday</span>
                  <span className="font-semibold text-slate-400 dark:text-slate-500 text-[10px]">
                    Default
                  </span>
                </div>

                {/* Saturday Switch */}
                <button
                  type="button"
                  onClick={() => onToggleDay("showSaturday")}
                  className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-100/70 dark:hover:bg-neutral-800/70 cursor-pointer transition-colors text-left"
                >
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                    Saturday
                  </span>
                  <div
                    className={`w-8 h-[18px] flex items-center rounded-full p-0.5 transition-colors duration-200 ease-in-out ${
                      preferences.showSaturday
                        ? "bg-amber-500"
                        : "bg-slate-300 dark:bg-neutral-700"
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

                {/* Sunday Switch */}
                <button
                  type="button"
                  onClick={() => onToggleDay("showSunday")}
                  className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-100/70 dark:hover:bg-neutral-800/70 cursor-pointer transition-colors text-left"
                >
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                    Sunday
                  </span>
                  <div
                    className={`w-8 h-[18px] flex items-center rounded-full p-0.5 transition-colors duration-200 ease-in-out ${
                      preferences.showSunday
                        ? "bg-amber-500"
                        : "bg-slate-300 dark:bg-neutral-700"
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
      )}
    </div>
  );
}
