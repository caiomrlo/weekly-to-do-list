"use client";

import { Calendar, Clock, Timer, X } from "lucide-react";

interface TaskScheduleInputsProps {
  date: string;
  time: string;
  durationText: string;
  onDateChange: (val: string) => void;
  onTimeChange: (val: string) => void;
  onDurationInputChange: (val: string) => void;
  onDurationBlur: () => void;
  onClearDuration: () => void;
}

export function TaskScheduleInputs({
  date,
  time,
  durationText,
  onDateChange,
  onTimeChange,
  onDurationInputChange,
  onDurationBlur,
  onClearDuration,
}: TaskScheduleInputsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {/* Date Pill */}
      <div className="relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium bg-slate-100/70 hover:bg-slate-100 dark:bg-slate-800/70 dark:hover:bg-slate-800 border border-slate-200/70 dark:border-slate-700/70 text-slate-700 dark:text-slate-200 transition-all cursor-pointer group">
        <Calendar className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0 pointer-events-none" />
        <span className="pointer-events-none">
          {date ? date.split("-").reverse().join("/") : "No date (Fixed)"}
        </span>
        {date ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDateChange("");
            }}
            className="relative z-10 text-slate-400 hover:text-rose-500 p-0.5 rounded transition-colors cursor-pointer"
            title="Remove date (move to Unscheduled)"
          >
            <X className="w-3 h-3" />
          </button>
        ) : null}
        <input
          type="date"
          value={date}
          onChange={(e) => {
            if (e.target.value) onDateChange(e.target.value);
          }}
          onClick={(e) => {
            try {
              (e.target as HTMLInputElement).showPicker?.();
            } catch {}
          }}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-0"
          title={date ? "Change date" : "Set date"}
        />
      </div>

      {/* Time Pill */}
      <div className="relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium bg-slate-100/70 hover:bg-slate-100 dark:bg-slate-800/70 dark:hover:bg-slate-800 border border-slate-200/70 dark:border-slate-700/70 text-slate-700 dark:text-slate-200 transition-all cursor-pointer group">
        <Clock className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0 pointer-events-none" />
        {time ? (
          <>
            <span className="pointer-events-none">{time}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onTimeChange("");
              }}
              className="relative z-10 text-slate-400 hover:text-rose-500 p-0.5 rounded transition-colors cursor-pointer"
              title="Remove time"
            >
              <X className="w-3 h-3" />
            </button>
          </>
        ) : (
          <span className="text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300 transition-colors pointer-events-none">
            Add time
          </span>
        )}
        <input
          type="time"
          value={time}
          onChange={(e) => onTimeChange(e.target.value)}
          onClick={(e) => {
            try {
              (e.target as HTMLInputElement).showPicker?.();
            } catch {}
          }}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-0"
          title={time ? `Time: ${time}` : "Add time"}
        />
      </div>

      {/* Duration Pill */}
      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium bg-slate-100/70 hover:bg-slate-100 dark:bg-slate-800/70 dark:hover:bg-slate-800 border border-slate-200/70 dark:border-slate-700/70 text-slate-700 dark:text-slate-200 focus-within:bg-white dark:focus-within:bg-slate-900 focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-400/20 transition-all">
        <Timer className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
        <input
          type="text"
          value={durationText}
          onChange={(e) => onDurationInputChange(e.target.value)}
          onBlur={onDurationBlur}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              (e.target as HTMLInputElement).blur();
            }
          }}
          placeholder="Duration"
          className="bg-transparent text-xs text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none w-14 focus:w-20 transition-all"
        />
        {durationText && (
          <button
            type="button"
            onClick={onClearDuration}
            className="text-slate-400 hover:text-rose-500 p-0.5 rounded transition-colors cursor-pointer"
            title="Clear duration"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}
