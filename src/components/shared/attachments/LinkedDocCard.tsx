"use client";

import { DocWithRelations } from "@/db/schema";
import { getProjectColorStyles } from "@/lib/project-utils";
import { FileText, ExternalLink, Loader2, X } from "lucide-react";

export interface LinkedDocCardProps {
  doc: DocWithRelations;
  isCardVariant: boolean;
  isUnlinking: boolean;
  onUnlink: () => void;
}

export function LinkedDocCard({
  doc,
  isCardVariant,
  isUnlinking,
  onUnlink,
}: LinkedDocCardProps) {
  const projectStyles = doc.project
    ? getProjectColorStyles(doc.project.color)
    : null;

  return (
    <div
      className={`group relative flex items-center border border-slate-200/70 dark:border-neutral-800/80 bg-white/70 dark:bg-neutral-900/60 hover:bg-white dark:hover:bg-neutral-900 transition-all hover:shadow-2xs overflow-hidden ${
        isCardVariant
          ? "gap-2 p-1.5 rounded-lg"
          : "gap-2.5 p-2 rounded-xl"
      }`}
    >
      <a
        href={`/docs/${doc.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 hover:opacity-85 transition-opacity"
        title="Open document in new tab"
      >
        <FileText className="w-4 h-4" />
      </a>

      <div className="min-w-0 flex-1 pr-1">
        <a
          href={`/docs/${doc.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate block hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
          title={doc.title || "Untitled Document"}
        >
          {doc.title || "Untitled Document"}
        </a>
        {doc.project && projectStyles && (
          <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] border mt-0.5 ${projectStyles.badgeClass}`}
          >
            <span
              className={`w-1 h-1 rounded-full ${projectStyles.dotClass}`}
            />
            <span className="truncate max-w-[80px]">
              {doc.project.name}
            </span>
          </span>
        )}
      </div>

      <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
        <a
          href={`/docs/${doc.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1 sm:p-1.5 rounded-lg text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors"
          title="Open document in new tab"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>

        <button
          type="button"
          onClick={onUnlink}
          disabled={isUnlinking}
          className="p-1 sm:p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer disabled:opacity-50"
          title="Unlink document"
        >
          {isUnlinking ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-500" />
          ) : (
            <X className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}
