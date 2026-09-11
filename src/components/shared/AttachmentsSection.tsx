"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import {
  AttachmentWithUrl,
  uploadAttachmentAction,
  deleteAttachmentAction,
  linkAttachmentToTaskAction,
  unlinkAttachmentFromTaskAction,
  getUserAvailableTaskAttachmentsAction,
  linkAttachmentToDocAction,
  unlinkAttachmentFromDocAction,
  getUserAvailableAttachmentsAction,
} from "@/app/actions/attachments";
import {
  Paperclip,
  UploadCloud,
  FileText,
  Trash2,
  ExternalLink,
  Loader2,
  Plus,
  AlertCircle,
  Link2,
  Unlink,
  Search,
  X,
} from "lucide-react";

export type AttachmentEntityTarget =
  | { type: "task"; id: string }
  | { type: "doc"; id: string };

export interface AttachmentsSectionProps {
  target: AttachmentEntityTarget;
  attachments: AttachmentWithUrl[];
  onAttachmentsChange: (updated: AttachmentWithUrl[]) => void;
  isLoading?: boolean;
  variant?: "modal" | "card";
}

function formatBytes(bytes: number, decimals = 1): string {
  if (!+bytes) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function AttachmentsSection({
  target,
  attachments,
  onAttachmentsChange,
  isLoading = false,
  variant = "modal",
}: AttachmentsSectionProps) {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // "Link Existing" popover state
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [availableAttachments, setAvailableAttachments] = useState<AttachmentWithUrl[]>([]);
  const [isLoadingAvailable, setIsLoadingAvailable] = useState(false);
  const [linkingId, setLinkingId] = useState<string | null>(null);

  const [, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pickerRef = useRef<HTMLDivElement | null>(null);

  const isCardVariant = variant === "card";
  const entityLabel = target.type === "task" ? "task" : "document";

  // Close picker on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setIsPickerOpen(false);
        setPickerSearch("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleOpenPicker = async () => {
    setIsPickerOpen(true);
    setPickerSearch("");
    setIsLoadingAvailable(true);
    try {
      const res =
        target.type === "task"
          ? await getUserAvailableTaskAttachmentsAction(target.id)
          : await getUserAvailableAttachmentsAction(target.id);

      if (res.attachments) {
        setAvailableAttachments(res.attachments);
      }
    } catch (err) {
      console.error("Failed to load available attachments:", err);
    } finally {
      setIsLoadingAvailable(false);
    }
  };

  const handleLinkExisting = async (attachment: AttachmentWithUrl) => {
    setLinkingId(attachment.id);
    try {
      const res =
        target.type === "task"
          ? await linkAttachmentToTaskAction(target.id, attachment.id)
          : await linkAttachmentToDocAction(target.id, attachment.id);

      if (res.attachment) {
        onAttachmentsChange([res.attachment, ...attachments]);
        setAvailableAttachments((prev) => prev.filter((a) => a.id !== attachment.id));
      } else if (res.error) {
        setUploadError(res.error);
      }
    } catch (err) {
      console.error(`Failed to link attachment to ${entityLabel}:`, err);
      setUploadError(`Could not link attachment to this ${entityLabel}.`);
    } finally {
      setLinkingId(null);
    }
  };

  const handleUploadFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setUploadError(null);
    setIsUploading(true);

    const fileList = Array.from(files);
    const newAttachments: AttachmentWithUrl[] = [];

    try {
      for (const file of fileList) {
        const formData = new FormData();
        if (target.type === "task") {
          formData.append("taskId", target.id);
        } else {
          formData.append("docId", target.id);
        }
        formData.append("file", file);

        const res = await uploadAttachmentAction(formData);
        if (res.error) {
          setUploadError(res.error);
          break;
        }

        if (res.attachment) {
          newAttachments.push(res.attachment);
        }
      }

      if (newAttachments.length > 0) {
        onAttachmentsChange([...newAttachments, ...attachments]);
      }
    } catch (err: unknown) {
      console.error(`Failed to upload ${entityLabel} attachment:`, err);
      setUploadError("Failed to upload file. Please try again.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleUploadFiles(e.target.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUploadFiles(e.dataTransfer.files);
    }
  };

  // Unlink from this entity (leaves file and other task/doc links intact)
  const handleUnlink = (attachmentId: string) => {
    setUnlinkingId(attachmentId);
    startTransition(async () => {
      try {
        const res =
          target.type === "task"
            ? await unlinkAttachmentFromTaskAction(target.id, attachmentId)
            : await unlinkAttachmentFromDocAction(target.id, attachmentId);

        if (res.success) {
          onAttachmentsChange(attachments.filter((a) => a.id !== attachmentId));
        } else if (res.error) {
          setUploadError(res.error);
        }
      } catch (err) {
        console.error(`Could not unlink attachment from ${entityLabel}:`, err);
        setUploadError(`Could not unlink attachment from this ${entityLabel}.`);
      } finally {
        setUnlinkingId(null);
      }
    });
  };

  // Permanently delete file from R2 and all links
  const handleDeletePermanently = (attachmentId: string) => {
    setDeletingId(attachmentId);
    startTransition(async () => {
      try {
        const res = await deleteAttachmentAction(attachmentId);
        if (res.success) {
          onAttachmentsChange(attachments.filter((a) => a.id !== attachmentId));
          setConfirmDeleteId(null);
        } else if (res.error) {
          setUploadError(res.error);
        }
      } catch (err) {
        console.error("Could not permanently delete attachment:", err);
        setUploadError("Could not permanently delete attachment.");
      } finally {
        setDeletingId(null);
      }
    });
  };

  const filteredAvailable = availableAttachments.filter((att) =>
    att.fileName.toLowerCase().includes(pickerSearch.toLowerCase().trim())
  );

  return (
    <div
      className={
        isCardVariant
          ? "w-full rounded-2xl bg-slate-50/70 dark:bg-slate-900/50 border border-slate-200/70 dark:border-slate-800/80 p-3 sm:p-4 space-y-2.5"
          : "space-y-3"
      }
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <label
            className={`${
              isCardVariant ? "text-[11px]" : "text-xs"
            } font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5`}
          >
            <Paperclip
              className={`w-3.5 h-3.5 ${isCardVariant ? "text-amber-500" : ""}`}
            />
            Attachments
          </label>
          {attachments.length > 0 && (
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-medium border ${
                isCardVariant
                  ? "bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border-amber-200/60 dark:border-amber-800/60"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200/60 dark:border-slate-700/60"
              }`}
            >
              {attachments.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Link Existing Popover Button */}
          <div className="relative" ref={pickerRef}>
            <button
              type="button"
              onClick={() => {
                if (isPickerOpen) {
                  setIsPickerOpen(false);
                } else {
                  handleOpenPicker();
                }
              }}
              className={`inline-flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors cursor-pointer ${
                isCardVariant ? "px-2 py-0.5 rounded-md" : "px-2.5 py-1 rounded-lg"
              }`}
              title={`Link an existing file to this ${entityLabel}`}
            >
              <Link2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Link Existing</span>
            </button>

            {/* Picker Popover */}
            {isPickerOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150 space-y-2.5">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5 text-amber-500" />
                    Link Existing File
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsPickerOpen(false)}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Search Input */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={pickerSearch}
                    onChange={(e) => setPickerSearch(e.target.value)}
                    placeholder="Search your files..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Files List */}
                <div className="max-h-56 overflow-y-auto space-y-1 pr-0.5">
                  {isLoadingAvailable ? (
                    <div className="py-6 flex items-center justify-center gap-2 text-slate-400 text-xs">
                      <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                      <span>Loading attachments...</span>
                    </div>
                  ) : filteredAvailable.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-400 dark:text-slate-500">
                      {availableAttachments.length === 0
                        ? "No other files available to link."
                        : "No matching files found."}
                    </div>
                  ) : (
                    filteredAvailable.map((att) => {
                      const isImage = att.contentType.startsWith("image/");
                      const isLinkingThis = linkingId === att.id;

                      return (
                        <button
                          key={att.id}
                          type="button"
                          onClick={() => handleLinkExisting(att)}
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

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
            onChange={handleFileSelect}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className={`inline-flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors cursor-pointer disabled:opacity-50 ${
              isCardVariant ? "px-2 py-0.5 rounded-md" : "px-2.5 py-1 rounded-lg"
            }`}
            title={`Upload a new file to this ${entityLabel}`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Attach</span>
          </button>
        </div>
      </div>

      {/* Error Notice */}
      {uploadError && (
        <div className="flex items-center gap-2 p-2.5 rounded-xl text-xs bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{uploadError}</span>
          <button
            type="button"
            onClick={() => setUploadError(null)}
            className="text-rose-500 hover:text-rose-700 dark:hover:text-rose-300 text-xs font-semibold cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      {/* Dropzone & Loading State */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => {
          if (attachments.length === 0 && !isUploading) {
            fileInputRef.current?.click();
          }
        }}
        className={`relative transition-all ${
          isCardVariant ? "rounded-xl" : "rounded-2xl"
        } border ${
          isDraggingOver
            ? "border-dashed border-amber-500 bg-amber-50/50 dark:bg-amber-950/40 scale-[1.01]"
            : attachments.length === 0
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
        {attachments.length === 0 && !isUploading && (
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
                Drag images or PDFs here, or click to browse
              </p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                PNG, JPG, WebP, GIF or PDF up to 20MB
              </p>
            </div>
          )
        )}

        {/* Attachments List */}
        {attachments.length > 0 && (
          <div
            className={`grid ${
              isCardVariant
                ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2"
                : "grid-cols-1 sm:grid-cols-2 gap-2.5"
            }`}
          >
            {attachments.map((attachment) => {
              const isImage = attachment.contentType.startsWith("image/");
              const isUnlinkingThis = unlinkingId === attachment.id;
              const isDeletingThis = deletingId === attachment.id;
              const isConfirmingDelete = confirmDeleteId === attachment.id;

              return (
                <div
                  key={attachment.id}
                  className={`group relative flex items-center border border-slate-200/70 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/60 hover:bg-white dark:hover:bg-slate-900 transition-all hover:shadow-xs overflow-hidden ${
                    isCardVariant
                      ? "gap-2.5 p-1.5 rounded-lg"
                      : "gap-3 p-2 rounded-xl"
                  }`}
                >
                  <a
                    href={attachment.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`relative rounded-${
                      isCardVariant ? "md w-9 h-9" : "lg w-11 h-11"
                    } overflow-hidden shrink-0 bg-slate-100 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50 flex items-center justify-center cursor-pointer transition-opacity hover:opacity-90`}
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
                        <FileText className={isCardVariant ? "w-4 h-4" : "w-5 h-5"} />
                        <span
                          className={`${
                            isCardVariant ? "text-[8px]" : "text-[9px]"
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
                      className="p-1 sm:p-1.5 rounded-lg text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title="Open original file in new tab"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    {/* Unlink from this entity */}
                    <button
                      type="button"
                      onClick={() => handleUnlink(attachment.id)}
                      disabled={isUnlinkingThis || isDeletingThis}
                      className="p-1 sm:p-1.5 rounded-lg text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors cursor-pointer disabled:opacity-50"
                      title={`Unlink from this ${entityLabel} (keeps file intact)`}
                    >
                      {isUnlinkingThis ? (
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
                          disabled={isDeletingThis}
                          onClick={() => handleDeletePermanently(attachment.id)}
                          className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                          title="Confirm permanent deletion"
                        >
                          {isDeletingThis ? "..." : "Delete?"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                          title="Cancel"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(attachment.id)}
                        disabled={isUnlinkingThis || isDeletingThis}
                        className="p-1 sm:p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer disabled:opacity-50"
                        title="Delete file permanently from all tasks and docs"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {isLoading && attachments.length === 0 && (
        <div className="flex items-center justify-center py-2 text-slate-400 text-xs">
          <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
          Loading attachments...
        </div>
      )}
    </div>
  );
}
