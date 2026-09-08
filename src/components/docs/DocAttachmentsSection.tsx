"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import {
  AttachmentWithUrl,
  uploadAttachmentAction,
  deleteAttachmentAction,
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

interface DocAttachmentsSectionProps {
  docId: string;
  attachments: AttachmentWithUrl[];
  onAttachmentsChange: (updated: AttachmentWithUrl[]) => void;
}

function formatBytes(bytes: number, decimals = 1): string {
  if (!+bytes) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function DocAttachmentsSection({
  docId,
  attachments,
  onAttachmentsChange,
}: DocAttachmentsSectionProps) {
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
      const res = await getUserAvailableAttachmentsAction(docId);
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
      const res = await linkAttachmentToDocAction(docId, attachment.id);
      if (res.attachment) {
        onAttachmentsChange([res.attachment, ...attachments]);
        setAvailableAttachments((prev) => prev.filter((a) => a.id !== attachment.id));
      } else if (res.error) {
        setUploadError(res.error);
      }
    } catch (err) {
      console.error("Failed to link attachment:", err);
      setUploadError("Could not link attachment to this document.");
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
        formData.append("docId", docId);
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
      console.error("Failed to upload document attachment:", err);
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

  // Unlink from this document (leaves file and other document links intact)
  const handleUnlink = (attachmentId: string) => {
    setUnlinkingId(attachmentId);
    startTransition(async () => {
      try {
        const res = await unlinkAttachmentFromDocAction(docId, attachmentId);
        if (res.success) {
          onAttachmentsChange(attachments.filter((a) => a.id !== attachmentId));
        } else if (res.error) {
          setUploadError(res.error);
        }
      } catch (err) {
        console.error("Could not unlink attachment:", err);
        setUploadError("Could not unlink attachment from this document.");
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
        console.error("Could not delete attachment:", err);
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
    <div className="max-w-xl sm:max-w-2xl rounded-xl bg-slate-50/70 dark:bg-slate-900/50 border border-slate-200/70 dark:border-slate-800/80 p-2.5 sm:p-3 space-y-2">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Paperclip className="w-3.5 h-3.5 text-indigo-500" />
            Attachments
          </label>
          {attachments.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-medium bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60">
              {attachments.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5">
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
              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-md text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
              title="Link an existing file to this document"
            >
              <Link2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Link Existing</span>
            </button>

            {/* Picker Popover */}
            {isPickerOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150 space-y-2.5">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5 text-indigo-500" />
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
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Files List */}
                <div className="max-h-56 overflow-y-auto space-y-1 pr-0.5">
                  {isLoadingAvailable ? (
                    <div className="py-6 flex items-center justify-center gap-2 text-slate-400 text-xs">
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
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
                          className="w-full flex items-center gap-2.5 p-2 rounded-xl text-left hover:bg-indigo-50/60 dark:hover:bg-indigo-950/40 border border-transparent hover:border-indigo-200/50 dark:hover:border-indigo-800/50 transition-colors cursor-pointer group disabled:opacity-50"
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
                            <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                              {att.fileName}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {formatBytes(att.fileSize)}
                            </p>
                          </div>
                          <div className="shrink-0 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                            {isLinkingThis ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
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

          {/* Native File Input Trigger */}
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
            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-md text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors cursor-pointer disabled:opacity-50"
            title="Upload a new file to this document"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Attach</span>
          </button>
        </div>
      </div>

      {/* Error Notice */}
      {uploadError && (
        <div className="flex items-center gap-2 p-2 rounded-lg text-xs bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50">
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

      {/* Dropzone & Attachments List */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => {
          if (attachments.length === 0 && !isUploading) {
            fileInputRef.current?.click();
          }
        }}
        className={`relative transition-all rounded-xl border ${
          isDraggingOver
            ? "border-dashed border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40"
            : attachments.length === 0
            ? "border-dashed border-slate-200/90 dark:border-slate-800/90 hover:border-indigo-400 dark:hover:border-indigo-500/70 bg-white/40 dark:bg-slate-900/30 cursor-pointer"
            : "border-transparent"
        }`}
      >
        {isUploading && (
          <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/50 border border-indigo-200/70 dark:border-indigo-800/70 text-indigo-600 dark:text-indigo-400 text-xs font-medium animate-pulse mb-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Uploading attachment...</span>
          </div>
        )}

        {/* Compact Empty state */}
        {attachments.length === 0 && !isUploading && (
          <div className="py-2.5 px-3 flex items-center justify-center gap-2 text-slate-400 dark:text-slate-500">
            <UploadCloud className="w-4 h-4 text-indigo-500 shrink-0" />
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Drag files here or click to browse
            </span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 hidden sm:inline">
              (Images, PDF up to 20MB)
            </span>
          </div>
        )}

        {/* Attachments List */}
        {attachments.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {attachments.map((attachment) => {
              const isImage = attachment.contentType.startsWith("image/");
              const isUnlinkingThis = unlinkingId === attachment.id;
              const isDeletingThis = deletingId === attachment.id;
              const isConfirmingDelete = confirmDeleteId === attachment.id;

              return (
                <div
                  key={attachment.id}
                  className="group relative flex items-center gap-2.5 p-1.5 rounded-lg border border-slate-200/70 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/60 hover:bg-white dark:hover:bg-slate-900 transition-all hover:shadow-xs overflow-hidden"
                >
                  <a
                    href={attachment.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative w-9 h-9 rounded-md overflow-hidden shrink-0 bg-slate-100 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50 flex items-center justify-center cursor-pointer transition-opacity hover:opacity-90"
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
                        <FileText className="w-4 h-4" />
                        <span className="text-[8px] font-bold tracking-tighter uppercase mt-[-2px]">
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
                      className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate block hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                      title={attachment.fileName}
                    >
                      {attachment.fileName}
                    </a>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">
                      {formatBytes(attachment.fileSize)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 shrink-0">
                    {/* View */}
                    <a
                      href={attachment.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 rounded-md text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title="Open file in new tab"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    {/* Unlink from this doc */}
                    <button
                      type="button"
                      onClick={() => handleUnlink(attachment.id)}
                      disabled={isUnlinkingThis || isDeletingThis}
                      className="p-1 rounded-md text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors cursor-pointer disabled:opacity-50"
                      title="Unlink from this document (keeps file intact)"
                    >
                      {isUnlinkingThis ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
                      ) : (
                        <Unlink className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {/* Delete Permanently (with confirmation) */}
                    {isConfirmingDelete ? (
                      <div className="flex items-center gap-1 bg-rose-50/95 dark:bg-rose-950/90 border border-rose-200 dark:border-rose-900 px-1.5 py-0.5 rounded-md">
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
                        className="p-1 rounded-md text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer disabled:opacity-50"
                        title="Delete file permanently from all docs and tasks"
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
    </div>
  );
}
