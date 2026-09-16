"use client";

import { useState } from "react";
import { AttachmentWithUrl } from "@/app/actions/attachments";
import { formatBytes } from "./utils";
import {
  Plus,
  Link2,
  UploadCloud,
  X,
  Search,
  Loader2,
  FileText,
} from "lucide-react";

export interface AttachmentPickerPopoverProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  isCardVariant: boolean;
  entityLabel: string;
  availableAttachments: AttachmentWithUrl[];
  isLoadingAvailable: boolean;
  linkingAttachmentId: string | null;
  onLinkAttachment: (attachment: AttachmentWithUrl) => void;
  onTriggerUpload: () => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function AttachmentPickerPopover({
  isOpen,
  onToggle,
  onClose,
  isCardVariant,
  entityLabel,
  availableAttachments,
  isLoadingAvailable,
  linkingAttachmentId,
  onLinkAttachment,
  onTriggerUpload,
  containerRef,
}: AttachmentPickerPopoverProps) {
  const [search, setSearch] = useState("");

  const filteredAttachments = availableAttachments.filter((att) =>
    att.fileName.toLowerCase().includes(search.toLowerCase().trim())
  );

  const handleUploadClick = () => {
    onTriggerUpload();
    onClose();
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={onToggle}
        className={`inline-flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors cursor-pointer ${
          isCardVariant ? "px-2 py-0.5 rounded-md" : "px-2.5 py-1 rounded-lg"
        }`}
        title={`Add an attachment to this ${entityLabel}`}
      >
        <Plus className="w-3.5 h-3.5" />
        <span>Add Attach</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150 space-y-2.5">
          {/* Popover Header with direct Upload button */}
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5 text-amber-500" />
              Attach File
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleUploadClick}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 hover:text-amber-700 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 px-2 py-0.5 rounded-lg transition-colors cursor-pointer border border-amber-200/60 dark:border-amber-800/60"
                title="Upload a new file from your computer"
              >
                <UploadCloud className="w-3 h-3" />
                <span>Upload</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Search input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search your files..."
              autoFocus
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Available files list */}
          <div className="max-h-56 overflow-y-auto space-y-1 pr-0.5">
            {isLoadingAvailable ? (
              <div className="py-6 flex items-center justify-center gap-2 text-slate-400 text-xs">
                <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                <span>Loading attachments...</span>
              </div>
            ) : filteredAttachments.length === 0 ? (
              <div className="py-5 text-center text-xs text-slate-400 dark:text-slate-500 space-y-2">
                <p>
                  {availableAttachments.length === 0
                    ? "No other files available to link."
                    : "No matching files found."}
                </p>
                <button
                  type="button"
                  onClick={handleUploadClick}
                  className="text-amber-600 dark:text-amber-400 hover:underline font-medium cursor-pointer"
                >
                  Upload a file from your computer
                </button>
              </div>
            ) : (
              filteredAttachments.map((att) => {
                const isImage = att.contentType.startsWith("image/");
                const isLinkingThis = linkingAttachmentId === att.id;

                return (
                  <button
                    key={att.id}
                    type="button"
                    onClick={() => onLinkAttachment(att)}
                    disabled={isLinkingThis}
                    className="w-full flex items-center gap-2.5 p-2 rounded-xl text-left hover:bg-amber-50/60 dark:hover:bg-amber-950/40 border border-transparent hover:border-amber-200/50 dark:hover:border-amber-800/50 transition-colors cursor-pointer group disabled:opacity-50"
                  >
                    <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 bg-slate-100 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50 flex items-center justify-center">
                      {isImage ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={att.thumbUrl || att.url}
                          alt={att.fileName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <FileText className="w-4 h-4 text-rose-500" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate group-hover:text-amber-600 dark:group-hover:text-amber-400">
                        {att.fileName}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {formatBytes(att.fileSize)}
                      </p>
                    </div>
                    <div className="shrink-0 text-slate-400 group-hover:text-amber-600 dark:group-hover:text-amber-400">
                      {isLinkingThis ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
                      ) : (
                        <Plus className="w-3.5 h-3.5" />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
