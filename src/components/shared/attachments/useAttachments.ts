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
import { AttachmentEntityTarget } from "./types";

export interface UseAttachmentsProps {
  target: AttachmentEntityTarget;
  attachments: AttachmentWithUrl[];
  onAttachmentsChange: (updated: AttachmentWithUrl[]) => void;
  onDocsCountChange?: (count: number) => void;
}

export function useAttachments({
  target,
  attachments,
  onAttachmentsChange,
  onDocsCountChange,
}: UseAttachmentsProps) {
  const isTaskTarget = target.type === "task";
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
  const [availableAttachments, setAvailableAttachments] = useState<AttachmentWithUrl[]>([]);
  const [isLoadingAvailableAttachments, setIsLoadingAvailableAttachments] = useState(false);
  const [linkingAttachmentId, setLinkingAttachmentId] = useState<string | null>(null);

  // Docs picker popover state
  const [isDocPickerOpen, setIsDocPickerOpen] = useState(false);
  const [availableDocs, setAvailableDocs] = useState<DocWithRelations[]>([]);
  const [isLoadingAvailableDocs, setIsLoadingAvailableDocs] = useState(false);
  const [linkingDocId, setLinkingDocId] = useState<string | null>(null);
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
      }
      if (
        docPickerRef.current &&
        !docPickerRef.current.contains(e.target as Node)
      ) {
        setIsDocPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- Attachments Actions ---

  const handleOpenAttachPicker = async () => {
    setIsAttachPickerOpen(true);
    setIsDocPickerOpen(false);
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

  const handleCreateAndLinkDoc = (title: string, projectId: string | null) => {
    startDocSubmitTransition(async () => {
      try {
        const res = await createAndLinkDocAction(target.id, {
          title,
          projectId,
        });

        if (res.doc) {
          const next = [res.doc, ...linkedDocs];
          setLinkedDocs(next);
          onDocsCountChange?.(next.length);
          setIsDocPickerOpen(false);
        }
      } catch (err) {
        console.error("Failed to create and link doc:", err);
      }
    });
  };

  return {
    isTaskTarget,
    entityLabel,
    fileInputRef,
    attachPickerRef,
    docPickerRef,
    isDraggingOver,
    isUploading,
    uploadError,
    setUploadError,
    unlinkingAttachmentId,
    deletingAttachmentId,
    confirmDeleteId,
    setConfirmDeleteId,
    linkedDocs,
    isLoadingDocs,
    unlinkingDocId,
    isAttachPickerOpen,
    setIsAttachPickerOpen,
    availableAttachments,
    isLoadingAvailableAttachments,
    linkingAttachmentId,
    isDocPickerOpen,
    setIsDocPickerOpen,
    availableDocs,
    isLoadingAvailableDocs,
    linkingDocId,
    userProjects,
    isSubmittingDoc,
    handleOpenAttachPicker,
    handleLinkExistingAttachment,
    handleFileSelect,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleUnlinkAttachment,
    handleDeleteAttachmentPermanently,
    handleOpenDocPicker,
    handleLinkDoc,
    handleUnlinkDoc,
    handleCreateAndLinkDoc,
  };
}
