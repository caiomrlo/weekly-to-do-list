"use client";

import { AttachmentWithUrl } from "@/app/actions/attachments";
import { formatBytes } from "./utils";
import {
  FileText,
  Trash2,
  ExternalLink,
  Loader2,
  Unlink,
  X,
} from "lucide-react";

export interface AttachmentCardProps {
  attachment: AttachmentWithUrl;
  isCardVariant: boolean;
  entityLabel: string;
  isUnlinking: boolean;
  isDeleting: boolean;
  isConfirmingDelete: boolean;
  onUnlink: () => void;
  onRequestDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
}

export function AttachmentCard({
  attachment,
  isCardVariant,
  entityLabel,
  isUnlinking,
  isDeleting,
  isConfirmingDelete,
  onUnlink,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
}: AttachmentCardProps) {
  const isImage = attachment.contentType.startsWith("image/");

  return (
    <div
      className={`group relative flex items-center border border-slate-200/70 dark:border-neutral-800/80 bg-white/70 dark:bg-neutral-900/60 hover:bg-white dark:hover:bg-neutral-900 transition-all hover:shadow-2xs overflow-hidden ${
        isCardVariant
          ? "gap-2.5 p-1.5 rounded-lg"
          : "gap-3 p-2 rounded-xl"
      }`}
    >
      <a
        href={attachment.url}
        target="_blank"
        rel="noopener noreferrer"
        className={`relative ${
          isCardVariant ? "rounded-md w-9 h-9" : "rounded-lg w-10 h-10"
        } overflow-hidden shrink-0 bg-slate-100 dark:bg-neutral-800 border border-slate-200/50 dark:border-neutral-700/50 flex items-center justify-center cursor-pointer transition-opacity hover:opacity-90`}
        title="Open original file"
      >
        {isImage ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={attachment.thumbUrl || attachment.url}
            alt={attachment.fileName}
            loading="lazy"
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-rose-500">
            <FileText className={isCardVariant ? "w-4 h-4" : "w-4.5 h-4.5"} />
            <span
              className={`${
                isCardVariant ? "text-[8px]" : "text-[8px]"
              } font-bold tracking-tighter uppercase mt-[-2px]`}
            >
              PDF
            </span>
          </div>
        )}
      </a>

      {/* Metadata */}
      <div className="min-w-0 flex-1 pr-1">
        <a
          href={attachment.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate block hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
          title={attachment.fileName}
        >
          {attachment.fileName}
        </a>
        <p className="text-[10px] text-slate-400 dark:text-slate-500">
          {formatBytes(attachment.fileSize)}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
        <a
          href={attachment.url}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1 sm:p-1.5 rounded-lg text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors"
          title="Open original file in new tab"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>

        {/* Unlink from this entity */}
        <button
          type="button"
          onClick={onUnlink}
          disabled={isUnlinking || isDeleting}
          className="p-1 sm:p-1.5 rounded-lg text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors cursor-pointer disabled:opacity-50"
          title={`Unlink from this ${entityLabel} (keeps file intact)`}
        >
          {isUnlinking ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
          ) : (
            <Unlink className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Delete permanently (with confirmation) */}
        {isConfirmingDelete ? (
          <div className="flex items-center gap-1 bg-rose-50/95 dark:bg-rose-950/90 border border-rose-200 dark:border-rose-900 px-1.5 py-0.5 rounded-lg">
            <button
              type="button"
              disabled={isDeleting}
              onClick={onConfirmDelete}
              className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
              title="Confirm permanent deletion"
            >
              {isDeleting ? "..." : "Delete?"}
            </button>
            <button
              type="button"
              onClick={onCancelDelete}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              title="Cancel"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onRequestDelete}
            disabled={isUnlinking || isDeleting}
            className="p-1 sm:p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer disabled:opacity-50"
            title="Delete file permanently from all tasks and docs"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
