"use client";

import React from "react";
import { UploadCloud, Loader2 } from "lucide-react";

export interface AttachmentDropzoneProps {
  isCardVariant: boolean;
  isTaskTarget: boolean;
  totalItemsCount: number;
  isUploading: boolean;
  isDraggingOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDropzoneClick: () => void;
  children?: React.ReactNode;
}

export function AttachmentDropzone({
  isCardVariant,
  isTaskTarget,
  totalItemsCount,
  isUploading,
  isDraggingOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onDropzoneClick,
  children,
}: AttachmentDropzoneProps) {
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={() => {
        if (totalItemsCount === 0 && !isUploading) {
          onDropzoneClick();
        }
      }}
      className={`relative transition-all ${
        isCardVariant ? "rounded-xl" : "rounded-2xl"
      } border ${
        isDraggingOver
          ? "border-dashed border-amber-500 bg-amber-50/50 dark:bg-amber-950/40 scale-[1.01]"
          : totalItemsCount === 0
          ? isCardVariant
            ? "border-dashed border-slate-200/90 dark:border-slate-800/90 hover:border-amber-400 dark:hover:border-amber-500/70 bg-white/40 dark:bg-slate-900/30 cursor-pointer"
            : "border-dashed border-slate-300/80 dark:border-slate-700/80 hover:border-amber-400 dark:hover:border-amber-500/70 bg-slate-50/40 dark:bg-slate-900/30 p-4 text-center cursor-pointer"
          : "border-transparent"
      }`}
    >
      {isUploading && (
        <div
          className={`flex items-center justify-center gap-2 ${
            isCardVariant ? "py-2 px-3 mb-2 rounded-lg" : "py-3 px-4 mb-3 rounded-xl"
          } bg-amber-50/70 dark:bg-amber-950/50 border border-amber-200/70 dark:border-amber-800/70 text-amber-600 dark:text-amber-400 text-xs font-medium animate-pulse`}
        >
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Uploading attachment to Cloudflare R2...</span>
        </div>
      )}

      {/* Empty state */}
      {totalItemsCount === 0 && !isUploading && (
        isCardVariant ? (
          <div className="py-2.5 px-3 flex items-center justify-center gap-2 text-slate-400 dark:text-slate-500">
            <UploadCloud className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Drag files here or click to browse
            </span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 hidden sm:inline">
              (Images, PDF up to 20MB)
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-1.5 text-slate-400 dark:text-slate-500">
            <UploadCloud className="w-6 h-6 stroke-[1.5] text-slate-400 dark:text-slate-500" />
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
              {isTaskTarget
                ? "Drag files here to attach, or use the buttons above to add attachments and link notes"
                : "Drag images or PDFs here, or click to browse"}
            </p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              PNG, JPG, WebP, GIF or PDF up to 20MB
            </p>
          </div>
        )
      )}

      {/* Grid container for rendered items */}
      {totalItemsCount > 0 && children}
    </div>
  );
}
