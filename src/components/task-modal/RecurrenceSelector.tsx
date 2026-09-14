"use client";

import { useState, useEffect, useRef } from "react";
import { RecurringRule, RecurrenceFrequency } from "@/db/schema";
import { getDayOfWeekFromStr, parseDateParts } from "@/lib/recurrence-utils";
import { Repeat, Calendar, Check, X } from "lucide-react";

interface RecurrenceSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  currentRule?: RecurringRule | null;
  taskDate?: string | null;
  onSave: (params: {
    frequency: RecurrenceFrequency | "none";
    interval: number;
    daysOfWeek?: number[];
    dayOfMonth?: number;
    monthOfYear?: number;
    endDate?: string | null;
  }) => void;
  isSaving?: boolean;
}

const WEEKDAYS = [
  { label: "M", full: "Mon", day: 1 },
  { label: "T", full: "Tue", day: 2 },
  { label: "W", full: "Wed", day: 3 },
  { label: "T", full: "Thu", day: 4 },
  { label: "F", full: "Fri", day: 5 },
  { label: "S", full: "Sat", day: 6 },
  { label: "S", full: "Sun", day: 0 },
];

function RecurrenceSelectorContent({
  onClose,
  currentRule,
  taskDate,
  onSave,
  isSaving = false,
}: RecurrenceSelectorProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  const defaultDay = taskDate ? getDayOfWeekFromStr(taskDate) : 1;
  const defaultDayOfMonth = taskDate ? parseDateParts(taskDate).day : 1;
  const defaultMonth = taskDate ? parseDateParts(taskDate).month : 1;

  const [frequency, setFrequency] = useState<RecurrenceFrequency | "none">(
    () => (currentRule ? currentRule.frequency : "none")
  );
  const [interval, setInterval] = useState<number>(() =>
    currentRule ? currentRule.interval : 1
  );
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(() =>
    currentRule?.daysOfWeek && currentRule.daysOfWeek.length > 0
      ? currentRule.daysOfWeek
      : [defaultDay]
  );
  const [dayOfMonth, setDayOfMonth] = useState<number>(
    () => currentRule?.dayOfMonth || defaultDayOfMonth
  );
  const [monthOfYear, setMonthOfYear] = useState<number>(
    () => currentRule?.monthOfYear || defaultMonth
  );
  const [hasEndDate, setHasEndDate] = useState<boolean>(() =>
    Boolean(currentRule?.endDate)
  );
  const [endDate, setEndDate] = useState<string>(
    () => currentRule?.endDate || ""
  );

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const toggleDayOfWeek = (day: number) => {
    setDaysOfWeek((prev) => {
      if (prev.includes(day)) {
        if (prev.length === 1) return prev;
        return prev.filter((d) => d !== day);
      } else {
        return [...prev, day].sort();
      }
    });
  };

  const handleApply = () => {
    onSave({
      frequency,
      interval: Math.max(1, interval),
      daysOfWeek: frequency === "weekly" ? daysOfWeek : undefined,
      dayOfMonth:
        frequency === "monthly" || frequency === "yearly"
          ? dayOfMonth
          : undefined,
      monthOfYear: frequency === "yearly" ? monthOfYear : undefined,
      endDate: hasEndDate && endDate.trim() ? endDate.trim() : null,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-2xs animate-in fade-in duration-100">
      <div
        ref={popoverRef}
        className="w-full max-w-sm rounded-2xl glass-panel bg-white/95 dark:bg-slate-900/95 shadow-xl border border-slate-200/80 dark:border-slate-800 p-4 space-y-4 text-slate-800 dark:text-slate-100 z-10"
      >
        <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-slate-800/60">
          <div className="flex items-center gap-2">
            <Repeat className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold">Recurrence</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Frequency selector buttons */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100/80 dark:bg-slate-800/80 rounded-xl text-xs font-medium">
          <button
            type="button"
            onClick={() => setFrequency("none")}
            className={`py-1.5 px-2.5 rounded-lg transition-all cursor-pointer ${
              frequency === "none"
                ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-2xs font-semibold"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
            }`}
          >
            {"Don't repeat"}
          </button>
          <button
            type="button"
            onClick={() => setFrequency("daily")}
            className={`py-1.5 px-2.5 rounded-lg transition-all cursor-pointer ${
              frequency === "daily"
                ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-2xs font-semibold"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
            }`}
          >
            Daily
          </button>
          <button
            type="button"
            onClick={() => setFrequency("weekly")}
            className={`py-1.5 px-2.5 rounded-lg transition-all cursor-pointer ${
              frequency === "weekly"
                ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-2xs font-semibold"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
            }`}
          >
            Weekly
          </button>
          <button
            type="button"
            onClick={() => setFrequency("monthly")}
            className={`py-1.5 px-2.5 rounded-lg transition-all cursor-pointer ${
              frequency === "monthly"
                ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-2xs font-semibold"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setFrequency("yearly")}
            className={`col-span-2 py-1.5 px-2.5 rounded-lg transition-all cursor-pointer ${
              frequency === "yearly"
                ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-2xs font-semibold"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
            }`}
          >
            Yearly
          </button>
        </div>

        {/* Detailed Options when a frequency is selected */}
        {frequency !== "none" && (
          <div className="space-y-3 pt-1 text-xs">
            {/* Interval input */}
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-600 dark:text-slate-300 font-medium">
                Repeat every
              </span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={interval}
                  onChange={(e) => setInterval(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-14 px-2 py-1 text-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                />
                <span className="text-slate-500 dark:text-slate-400">
                  {frequency === "daily" && (interval === 1 ? "day" : "days")}
                  {frequency === "weekly" && (interval === 1 ? "week" : "weeks")}
                  {frequency === "monthly" && (interval === 1 ? "month" : "months")}
                  {frequency === "yearly" && (interval === 1 ? "year" : "years")}
                </span>
              </div>
            </div>

            {/* Weekly: Day of week toggles */}
            {frequency === "weekly" && (
              <div>
                <span className="block text-slate-600 dark:text-slate-300 font-medium mb-1.5">
                  On days
                </span>
                <div className="flex items-center justify-between gap-1">
                  {WEEKDAYS.map((w) => {
                    const isSelected = daysOfWeek.includes(w.day);
                    return (
                      <button
                        key={w.day}
                        type="button"
                        onClick={() => toggleDayOfWeek(w.day)}
                        title={w.full}
                        className={`w-8 h-8 rounded-lg font-semibold text-xs transition-all cursor-pointer ${
                          isSelected
                            ? "bg-amber-500 text-white shadow-2xs"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                        }`}
                      >
                        {w.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Monthly: Day of month */}
            {frequency === "monthly" && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-600 dark:text-slate-300 font-medium">
                  On day
                </span>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={dayOfMonth}
                  onChange={(e) =>
                    setDayOfMonth(Math.min(31, Math.max(1, parseInt(e.target.value, 10) || 1)))
                  }
                  className="w-14 px-2 py-1 text-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>
            )}

            {/* Yearly: Day and month */}
            {frequency === "yearly" && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-600 dark:text-slate-300 font-medium">
                  Date
                </span>
                <div className="flex items-center gap-1.5">
                  <select
                    value={monthOfYear}
                    onChange={(e) => setMonthOfYear(parseInt(e.target.value, 10))}
                    className="px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                  >
                    {[
                      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
                      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
                    ].map((m, idx) => (
                      <option key={idx + 1} value={idx + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={dayOfMonth}
                    onChange={(e) =>
                      setDayOfMonth(Math.min(31, Math.max(1, parseInt(e.target.value, 10) || 1)))
                    }
                    className="w-12 px-2 py-1 text-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            )}

            {/* End Date */}
            <div className="pt-2 border-t border-slate-200/50 dark:border-slate-800/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-300 font-medium">
                  Ends
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setHasEndDate(false)}
                    className={`px-2 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors ${
                      !hasEndDate
                        ? "bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white"
                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    }`}
                  >
                    Never
                  </button>
                  <button
                    type="button"
                    onClick={() => setHasEndDate(true)}
                    className={`px-2 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors ${
                      hasEndDate
                        ? "bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white"
                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    }`}
                  >
                    On date
                  </button>
                </div>
              </div>

              {hasEndDate && (
                <div className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                  <Calendar className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-transparent text-xs text-slate-800 dark:text-slate-100 focus:outline-none"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={handleApply}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <Check className="w-3.5 h-3.5" />
            {isSaving ? "Saving..." : "Apply"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function RecurrenceSelector(props: RecurrenceSelectorProps) {
  if (!props.isOpen) return null;
  return <RecurrenceSelectorContent {...props} />;
}
