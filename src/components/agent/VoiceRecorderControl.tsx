"use client";

import { useEffect } from "react";
import { useAudioRecorder } from "@/lib/hooks/useAudioRecorder";
import { VoiceWaveformCanvas } from "./VoiceWaveformCanvas";
import { Mic, Trash2, Check, Loader2, X, AlertCircle } from "lucide-react";

interface VoiceRecorderControlProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function VoiceRecorderControl({
  onTranscript,
  disabled = false,
}: VoiceRecorderControlProps) {
  const {
    isRecording,
    isTranscribing,
    duration,
    maxDuration,
    error,
    analyserNode,
    startRecording,
    stopRecording,
    cancelRecording,
    clearError,
  } = useAudioRecorder({
    onTranscript,
    maxDurationSeconds: 90,
  });

  // Auto-dismiss errors after 6 seconds
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => {
      clearError();
    }, 6000);
    return () => clearTimeout(timer);
  }, [error, clearError]);

  return (
    <>
      {/* Transient error notification */}
      {error && (
        <div className="absolute -top-11 left-0 right-0 z-20 mx-auto max-w-md px-2">
          <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-neutral-900 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs shadow-md">
            <div className="flex items-center gap-1.5 min-w-0">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
              <span className="truncate">{error}</span>
            </div>
            <button
              type="button"
              onClick={clearError}
              className="p-0.5 rounded-md hover:bg-rose-100 dark:hover:bg-rose-950/60 text-rose-600 dark:text-rose-400 cursor-pointer shrink-0 transition-colors"
              aria-label="Dismiss error"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Active Recording State: seamlessly replaces composer input */}
      {isRecording ? (
        <div className="absolute inset-0 z-10 flex items-center justify-between gap-2 px-3 sm:px-4 bg-slate-100 dark:bg-neutral-800 rounded-3xl animate-in fade-in duration-200">
          {/* Cancel button */}
          <button
            type="button"
            onClick={cancelRecording}
            className="p-1.5 sm:p-2 rounded-full text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer shrink-0"
            title="Cancel recording"
            aria-label="Cancel recording"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {/* Recording pulse and timer */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
            </span>
            <span className="text-xs font-mono font-medium text-slate-700 dark:text-slate-300 select-none">
              {formatDuration(duration)} / {formatDuration(maxDuration)}
            </span>
          </div>

          {/* Audio Waveform Canvas */}
          <div className="flex-1 min-w-[70px] max-w-[260px] sm:max-w-xs mx-2">
            <VoiceWaveformCanvas
              analyserNode={analyserNode}
              isRecording={isRecording}
              className="w-full h-7"
            />
          </div>

          {/* Finish & Transcribe button */}
          <button
            type="button"
            onClick={stopRecording}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-amber-500 hover:bg-amber-600 text-white flex items-center justify-center transition-colors cursor-pointer shadow-xs shrink-0"
            title="Finish and transcribe"
            aria-label="Finish and transcribe"
          >
            <Check className="w-4 h-4" />
          </button>
        </div>
      ) : isTranscribing ? (
        /* Transcribing Loading State */
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-300/80 dark:border-amber-700/60 text-amber-700 dark:text-amber-300 text-xs shrink-0 self-end mb-0.5">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
          <span className="hidden sm:inline font-medium">Transcribing...</span>
        </div>
      ) : (
        /* Idle Microphone Button: Positioned immediately left of Send */
        <button
          type="button"
          onClick={startRecording}
          disabled={disabled}
          className="w-8 h-8 sm:w-9 sm:h-9 rounded-full text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-200/80 dark:hover:bg-neutral-700/80 flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0 self-end"
          title="Use microphone to dictate message (up to 90s)"
          aria-label="Use microphone to dictate message"
        >
          <Mic className="w-4 h-4" />
        </button>
      )}
    </>
  );
}
