"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { DocWithRelations, Project } from "@/db/schema";
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
  getTaskDocsAction,
  linkDocToTaskAction,
  unlinkDocFromTaskAction,
  createAndLinkDocAction,
  getUserDocsAction,
} from "@/app/actions/docs";
import { getUserProjectsAction } from "@/app/actions/projects";
import { getProjectColorStyles } from "@/lib/project-utils";
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
  Folder,
} from "lucide-react";

export type AttachmentEntityTarget =
  | { type: "task"; id: string }
  | { type: "doc"; id: string };

export interface AttachmentsAndDocsSectionProps {
  target: AttachmentEntityTarget;
  attachments: AttachmentWithUrl[];
  onAttachmentsChange: (updated: AttachmentWithUrl[]) => void;
  isLoading?: boolean;
  variant?: "modal" | "card";
  onDocsCountChange?: (count: number) => void;
}

function formatBytes(bytes: number, decimals = 1): string {
  if (!+bytes) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function AttachmentsAndDocsSection({
  target,
  attachments,
  onAttachmentsChange,
  isLoading = false,
  variant = "modal",
  onDocsCountChange,
}: AttachmentsAndDocsSectionProps) {
  const isTaskTarget = target.type === "task";
  const isCardVariant = variant === "card";
  const entityLabel = isTaskTarget ? "task" : "document";

  // Drag & drop / upload states
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [unlinkingAttachmentId, setUnlinkingAttachmentId] = useState<string | null>(null);
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Docs state (for task target)
  const [linkedDocs, setLinkedDocs] = useState<DocWithRelations[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(isTaskTarget);
  const [unlinkingDocId, setUnlinkingDocId] = useState<string | null>(null);

  // Attachments picker popover state
  const [isAttachPickerOpen, setIsAttachPickerOpen] = useState(false);
  const [attachSearch, setAttachSearch] = useState("");
  const [availableAttachments, setAvailableAttachments] = useState<AttachmentWithUrl[]>([]);
  const [isLoadingAvailableAttachments, setIsLoadingAvailableAttachments] = useState(false);
  const [linkingAttachmentId, setLinkingAttachmentId] = useState<string | null>(null);

  // Docs picker popover state
  const [isDocPickerOpen, setIsDocPickerOpen] = useState(false);
  const [docSearch, setDocSearch] = useState("");
  const [availableDocs, setAvailableDocs] = useState<DocWithRelations[]>([]);
  const [isLoadingAvailableDocs, setIsLoadingAvailableDocs] = useState(false);
  const [linkingDocId, setLinkingDocId] = useState<string | null>(null);

  // Inline Doc Creation state inside doc picker
  const [isCreatingNewDoc, setIsCreatingNewDoc] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState("");
  const [newDocProjectId, setNewDocProjectId] = useState<string | null>(null);
  const [userProjects, setUserProjects] = useState<Project[]>([]);
  const [isSubmittingDoc, startDocSubmitTransition] = useTransition();

  const [, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const attachPickerRef = useRef<HTMLDivElement | null>(null);
  const docPickerRef = useRef<HTMLDivElement | null>(null);

  // Load linked docs when target is a task
  useEffect(() => {
    if (!isTaskTarget) return;

    let isMounted = true;

    getTaskDocsAction(target.id).then((res) => {
      if (isMounted) {
        if (res.docs) {
          setLinkedDocs(res.docs);
        }
        setIsLoadingDocs(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [target.id, isTaskTarget]);

  // Close pickers on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        attachPickerRef.current &&
        !attachPickerRef.current.contains(e.target as Node)
      ) {
        setIsAttachPickerOpen(false);
        setAttachSearch("");
      }
      if (
        docPickerRef.current &&
        !docPickerRef.current.contains(e.target as Node)
      ) {
        setIsDocPickerOpen(false);
        setIsCreatingNewDoc(false);
        setDocSearch("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- Attachments Actions ---

  const handleOpenAttachPicker = async () => {
    setIsAttachPickerOpen(true);
    setIsDocPickerOpen(false);
    setAttachSearch("");
    setIsLoadingAvailableAttachments(true);
    try {
      const res = isTaskTarget
        ? await getUserAvailableTaskAttachmentsAction(target.id)
        : await getUserAvailableAttachmentsAction(target.id);

      if (res.attachments) {
        setAvailableAttachments(res.attachments);
      }
    } catch (err) {
      console.error("Failed to load available attachments:", err);
    } finally {
      setIsLoadingAvailableAttachments(false);
    }
  };

  const handleLinkExistingAttachment = async (attachment: AttachmentWithUrl) => {
    setLinkingAttachmentId(attachment.id);
    try {
      const res = isTaskTarget
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
      setLinkingAttachmentId(null);
    }
  };

  const handleUploadFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setUploadError(null);
    setIsUploading(true);
    setIsAttachPickerOpen(false);

    const fileList = Array.from(files);
    const newAttachments: AttachmentWithUrl[] = [];

    try {
      for (const file of fileList) {
        const formData = new FormData();
        if (isTaskTarget) {
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

  const handleUnlinkAttachment = (attachmentId: string) => {
    setUnlinkingAttachmentId(attachmentId);
    startTransition(async () => {
      try {
        const res = isTaskTarget
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
        setUnlinkingAttachmentId(null);
      }
    });
  };

  const handleDeleteAttachmentPermanently = (attachmentId: string) => {
    setDeletingAttachmentId(attachmentId);
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
        setDeletingAttachmentId(null);
      }
    });
  };

  // --- Docs Actions (Task target only) ---

  const handleOpenDocPicker = async () => {
    setIsDocPickerOpen(true);
    setIsAttachPickerOpen(false);
    setIsCreatingNewDoc(false);
    setDocSearch("");
    setIsLoadingAvailableDocs(true);

    try {
      const [docsRes, projRes] = await Promise.all([
        getUserDocsAction(),
        getUserProjectsAction(),
      ]);
      if (docsRes.docs) {
        setAvailableDocs(docsRes.docs);
      }
      if (projRes.projects) {
        setUserProjects(projRes.projects);
      }
    } catch (err) {
      console.error("Failed to load available docs:", err);
    } finally {
      setIsLoadingAvailableDocs(false);
    }
  };

  const handleLinkDoc = async (doc: DocWithRelations) => {
    setLinkingDocId(doc.id);
    try {
      const res = await linkDocToTaskAction(target.id, doc.id);
      if (res.success && res.doc) {
        const next = [res.doc, ...linkedDocs];
        setLinkedDocs(next);
        onDocsCountChange?.(next.length);
        setIsDocPickerOpen(false);
      }
    } catch (err) {
      console.error("Failed to link doc:", err);
    } finally {
      setLinkingDocId(null);
    }
  };

  const handleUnlinkDoc = async (docId: string) => {
    setUnlinkingDocId(docId);
    try {
      const res = await unlinkDocFromTaskAction(target.id, docId);
      if (res.success) {
        const next = linkedDocs.filter((d) => d.id !== docId);
        setLinkedDocs(next);
        onDocsCountChange?.(next.length);
      }
    } catch (err) {
      console.error("Failed to unlink doc:", err);
    } finally {
      setUnlinkingDocId(null);
    }
  };

  const handleCreateAndLinkDoc = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newDocTitle.trim();
    if (!trimmed) return;

    startDocSubmitTransition(async () => {
      try {
        const res = await createAndLinkDocAction(target.id, {
          title: trimmed,
          projectId: newDocProjectId,
        });

        if (res.doc) {
          const next = [res.doc, ...linkedDocs];
          setLinkedDocs(next);
          onDocsCountChange?.(next.length);
          setNewDocTitle("");
          setNewDocProjectId(null);
          setIsCreatingNewDoc(false);
          setIsDocPickerOpen(false);
        }
      } catch (err) {
        console.error("Failed to create and link doc:", err);
      }
    });
  };

  // Filters for pickers
  const filteredAvailableAttachments = availableAttachments.filter((att) =>
    att.fileName.toLowerCase().includes(attachSearch.toLowerCase().trim())
  );

  const unlinkedDocs = availableDocs.filter(
    (d) => !linkedDocs.some((ld) => ld.id === d.id)
  );
  const filteredAvailableDocs = unlinkedDocs.filter((d) => {
    if (!docSearch.trim()) return true;
    return d.title.toLowerCase().includes(docSearch.toLowerCase().trim());
  });

  const totalItemsCount = isTaskTarget
    ? attachments.length + linkedDocs.length
    : attachments.length;

  const isInitialLoading = isTaskTarget
    ? (isLoading || isLoadingDocs) && totalItemsCount === 0
    : isLoading && attachments.length === 0;

  return (
    <div
      className={
        isCardVariant
          ? "w-full rounded-2xl bg-slate-50/70 dark:bg-slate-900/50 border border-slate-200/70 dark:border-slate-800/80 p-3 sm:p-4 space-y-2.5"
          : "space-y-3"
      }
    >
      {/* Hidden native file input for upload */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Header Bar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <label
            className={`${
              isCardVariant ? "text-[11px]" : "text-xs"
            } font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5 truncate`}
          >
            <Paperclip
              className={`w-3.5 h-3.5 shrink-0 ${isCardVariant ? "text-amber-500" : ""}`}
            />
            <span>{isTaskTarget ? "Attachments and Docs" : "Attachments"}</span>
          </label>
          {totalItemsCount > 0 && (
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-medium border shrink-0 ${
                isCardVariant
                  ? "bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border-amber-200/60 dark:border-amber-800/60"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200/60 dark:border-slate-700/60"
              }`}
            >
              {totalItemsCount}
            </span>
          )}
        </div>

        {/* Header Action Triggers */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* + Add Attach Popover */}
          <div className="relative" ref={attachPickerRef}>
            <button
              type="button"
              onClick={() => {
                if (isAttachPickerOpen) {
                  setIsAttachPickerOpen(false);
                } else {
                  handleOpenAttachPicker();
                }
              }}
              className={`inline-flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors cursor-pointer ${
                isCardVariant ? "px-2 py-0.5 rounded-md" : "px-2.5 py-1 rounded-lg"
              }`}
              title={`Add an attachment to this ${entityLabel}`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Attach</span>
            </button>

            {isAttachPickerOpen && (
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
                      onClick={() => {
                        fileInputRef.current?.click();
                        setIsAttachPickerOpen(false);
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 hover:text-amber-700 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 px-2 py-0.5 rounded-lg transition-colors cursor-pointer border border-amber-200/60 dark:border-amber-800/60"
                      title="Upload a new file from your computer"
                    >
                      <UploadCloud className="w-3 h-3" />
                      <span>Upload</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAttachPickerOpen(false)}
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
                    value={attachSearch}
                    onChange={(e) => setAttachSearch(e.target.value)}
                    placeholder="Search your files..."
                    autoFocus
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Available files list */}
                <div className="max-h-56 overflow-y-auto space-y-1 pr-0.5">
                  {isLoadingAvailableAttachments ? (
                    <div className="py-6 flex items-center justify-center gap-2 text-slate-400 text-xs">
                      <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                      <span>Loading attachments...</span>
                    </div>
                  ) : filteredAvailableAttachments.length === 0 ? (
                    <div className="py-5 text-center text-xs text-slate-400 dark:text-slate-500 space-y-2">
                      <p>
                        {availableAttachments.length === 0
                          ? "No other files available to link."
                          : "No matching files found."}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          fileInputRef.current?.click();
                          setIsAttachPickerOpen(false);
                        }}
                        className="text-amber-600 dark:text-amber-400 hover:underline font-medium cursor-pointer"
                      >
                        Upload a file from your computer
                      </button>
                    </div>
                  ) : (
                    filteredAvailableAttachments.map((att) => {
                      const isImage = att.contentType.startsWith("image/");
                      const isLinkingThis = linkingAttachmentId === att.id;

                      return (
                        <button
                          key={att.id}
                          type="button"
                          onClick={() => handleLinkExistingAttachment(att)}
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

          {/* + Add Doc Popover (Strictly hidden when in Docs Workspace) */}
          {isTaskTarget && (
            <div className="relative" ref={docPickerRef}>
              <button
                type="button"
                onClick={() => {
                  if (isDocPickerOpen) {
                    setIsDocPickerOpen(false);
                  } else {
                    handleOpenDocPicker();
                  }
                }}
                className={`inline-flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors cursor-pointer ${
                  isCardVariant ? "px-2 py-0.5 rounded-md" : "px-2.5 py-1 rounded-lg"
                }`}
                title="Link or create a document for this task"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Doc</span>
              </button>

              {isDocPickerOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-3 z-50 animate-in fade-in zoom-in-95 duration-150">
                  {!isCreatingNewDoc ? (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200">
                        <span className="flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-amber-500" />
                          Link Document
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setIsCreatingNewDoc(true)}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 hover:text-amber-700 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 px-2 py-0.5 rounded-lg transition-colors cursor-pointer border border-amber-200/60 dark:border-amber-800/60"
                          >
                            <Plus className="w-3 h-3" />
                            <span>New Doc</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsDocPickerOpen(false)}
                            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md transition-colors cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Search bar */}
                      <div className="relative">
                        <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={docSearch}
                          onChange={(e) => setDocSearch(e.target.value)}
                          placeholder="Search existing docs..."
                          autoFocus
                          className="w-full text-xs pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-amber-500 transition-all"
                        />
                      </div>

                      {/* Docs List */}
                      <div className="max-h-48 overflow-y-auto space-y-1 pr-0.5">
                        {isLoadingAvailableDocs ? (
                          <div className="py-4 text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
                            <span>Loading docs...</span>
                          </div>
                        ) : filteredAvailableDocs.length === 0 ? (
                          <div className="py-4 text-center text-xs text-slate-400 space-y-1">
                            <p>No available documents found.</p>
                            <button
                              type="button"
                              onClick={() => setIsCreatingNewDoc(true)}
                              className="text-amber-600 dark:text-amber-400 hover:underline cursor-pointer font-medium"
                            >
                              Create a new doc
                            </button>
                          </div>
                        ) : (
                          filteredAvailableDocs.map((doc) => {
                            const projectStyles = doc.project
                              ? getProjectColorStyles(doc.project.color)
                              : null;
                            const isLinkingThis = linkingDocId === doc.id;

                            return (
                              <button
                                key={doc.id}
                                type="button"
                                onClick={() => handleLinkDoc(doc)}
                                disabled={isLinkingThis}
                                className="w-full text-left px-2.5 py-2 rounded-xl text-xs hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-colors flex items-center justify-between gap-2 cursor-pointer group disabled:opacity-50"
                              >
                                <div className="min-w-0 flex-1">
                                  <span className="font-medium text-slate-700 dark:text-slate-200 truncate block group-hover:text-amber-600 dark:group-hover:text-amber-400">
                                    {doc.title || "Untitled Document"}
                                  </span>
                                  {doc.project && projectStyles && (
                                    <span
                                      className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] border mt-0.5 ${projectStyles.badgeClass}`}
                                    >
                                      <span
                                        className={`w-1 h-1 rounded-full ${projectStyles.dotClass}`}
                                      />
                                      <span>{doc.project.name}</span>
                                    </span>
                                  )}
                                </div>
                                <div className="shrink-0 text-slate-400 group-hover:text-amber-600">
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
                  ) : (
                    /* Inline Doc Creation Form */
                    <form onSubmit={handleCreateAndLinkDoc} className="space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200">
                        <span>Create & Link Doc</span>
                        <button
                          type="button"
                          onClick={() => setIsCreatingNewDoc(false)}
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <input
                        type="text"
                        value={newDocTitle}
                        onChange={(e) => setNewDocTitle(e.target.value)}
                        placeholder="Document title..."
                        autoFocus
                        required
                        className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-amber-500 transition-all"
                      />

                      {userProjects.length > 0 && (
                        <div className="space-y-1">
                          <label className="text-[11px] text-slate-400 flex items-center gap-1">
                            <Folder className="w-3 h-3" />
                            <span>Project (Optional)</span>
                          </label>
                          <select
                            value={newDocProjectId || ""}
                            onChange={(e) => setNewDocProjectId(e.target.value || null)}
                            className="w-full text-xs px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none"
                          >
                            <option value="">No Project</option>
                            {userProjects.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <button
                          type="button"
                          onClick={() => setIsCreatingNewDoc(false)}
                          className="px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isSubmittingDoc || !newDocTitle.trim()}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 disabled:opacity-50 text-white rounded-xl text-xs font-medium shadow-xs transition-all cursor-pointer"
                        >
                          {isSubmittingDoc ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              <span>Creating...</span>
                            </>
                          ) : (
                            <span>Create & Link</span>
                          )}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>
          )}
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

      {/* Dropzone & Items Display */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => {
          if (totalItemsCount === 0 && !isUploading) {
            fileInputRef.current?.click();
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

        {/* Unified Items Grid */}
        {totalItemsCount > 0 && (
          <div
            className={`grid ${
              isCardVariant
                ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2"
                : "grid-cols-1 sm:grid-cols-2 gap-2"
            }`}
          >
            {/* 1. Linked Docs (if any) */}
            {isTaskTarget &&
              linkedDocs.map((doc) => {
                const isUnlinkingThis = unlinkingDocId === doc.id;
                const projectStyles = doc.project
                  ? getProjectColorStyles(doc.project.color)
                  : null;

                return (
                  <div
                    key={`doc-${doc.id}`}
                    className={`group relative flex items-center border border-slate-200/70 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/60 hover:bg-white dark:hover:bg-slate-900 transition-all hover:shadow-2xs overflow-hidden ${
                      isCardVariant
                        ? "gap-2 p-1.5 rounded-lg"
                        : "gap-2.5 p-2 rounded-xl"
                    }`}
                  >
                    <a
                      href={`/docs/${doc.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 hover:opacity-85 transition-opacity`}
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
                        className="p-1 sm:p-1.5 rounded-lg text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Open document in new tab"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>

                      <button
                        type="button"
                        onClick={() => handleUnlinkDoc(doc.id)}
                        disabled={isUnlinkingThis}
                        className="p-1 sm:p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer disabled:opacity-50"
                        title="Unlink document"
                      >
                        {isUnlinkingThis ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-500" />
                        ) : (
                          <X className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}

            {/* 2. Attached Files */}
            {attachments.map((attachment) => {
              const isImage = attachment.contentType.startsWith("image/");
              const isUnlinkingThis = unlinkingAttachmentId === attachment.id;
              const isDeletingThis = deletingAttachmentId === attachment.id;
              const isConfirmingDelete = confirmDeleteId === attachment.id;

              return (
                <div
                  key={`att-${attachment.id}`}
                  className={`group relative flex items-center border border-slate-200/70 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/60 hover:bg-white dark:hover:bg-slate-900 transition-all hover:shadow-2xs overflow-hidden ${
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
                      isCardVariant ? "md w-9 h-9" : "lg w-10 h-10"
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
                      className="p-1 sm:p-1.5 rounded-lg text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title="Open original file in new tab"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    {/* Unlink from this entity */}
                    <button
                      type="button"
                      onClick={() => handleUnlinkAttachment(attachment.id)}
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
                          onClick={() => handleDeleteAttachmentPermanently(attachment.id)}
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

      {isInitialLoading && (
        <div className="flex items-center justify-center py-2 text-slate-400 text-xs">
          <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5 text-amber-500" />
          <span>
            {isTaskTarget ? "Loading attachments & docs..." : "Loading attachments..."}
          </span>
        </div>
      )}
    </div>
  );
}

// Backwards compatibility alias
export { AttachmentsAndDocsSection as AttachmentsSection };
