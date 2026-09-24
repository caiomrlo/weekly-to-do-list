"use client";

import { Paperclip, Loader2, AlertCircle } from "lucide-react";

import {
  AttachmentEntityTarget,
  AttachmentsAndDocsSectionProps,
  formatBytes,
  AttachmentCard,
  LinkedDocCard,
  AttachmentPickerPopover,
  DocPickerPopover,
  AttachmentDropzone,
  useAttachments,
} from "./attachments";

export type { AttachmentEntityTarget, AttachmentsAndDocsSectionProps };
export { formatBytes };

export function AttachmentsAndDocsSection({
  target,
  attachments,
  onAttachmentsChange,
  isLoading = false,
  variant = "modal",
  onDocsCountChange,
}: AttachmentsAndDocsSectionProps) {
  const isCardVariant = variant === "card";

  const {
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
  } = useAttachments({
    target,
    attachments,
    onAttachmentsChange,
    onDocsCountChange,
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
          ? "w-full rounded-2xl bg-slate-50/70 dark:bg-neutral-900/50 border border-slate-200/70 dark:border-neutral-800/80 p-3 sm:p-4 space-y-2.5"
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
                  : "bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-slate-400 border-slate-200/60 dark:border-neutral-700/60"
              }`}
            >
              {totalItemsCount}
            </span>
          )}
        </div>

        {/* Header Action Triggers */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* + Add Attach Popover */}
          <AttachmentPickerPopover
            isOpen={isAttachPickerOpen}
            onToggle={() => {
              if (isAttachPickerOpen) {
                setIsAttachPickerOpen(false);
              } else {
                handleOpenAttachPicker();
              }
            }}
            onClose={() => setIsAttachPickerOpen(false)}
            isCardVariant={isCardVariant}
            entityLabel={entityLabel}
            availableAttachments={availableAttachments}
            isLoadingAvailable={isLoadingAvailableAttachments}
            linkingAttachmentId={linkingAttachmentId}
            onLinkAttachment={handleLinkExistingAttachment}
            onTriggerUpload={() => fileInputRef.current?.click()}
            containerRef={attachPickerRef}
          />

          {/* + Add Doc Popover (Strictly hidden when in Docs Workspace) */}
          {isTaskTarget && (
            <DocPickerPopover
              isOpen={isDocPickerOpen}
              onToggle={() => {
                if (isDocPickerOpen) {
                  setIsDocPickerOpen(false);
                } else {
                  handleOpenDocPicker();
                }
              }}
              onClose={() => setIsDocPickerOpen(false)}
              isCardVariant={isCardVariant}
              availableDocs={availableDocs}
              linkedDocs={linkedDocs}
              userProjects={userProjects}
              isLoadingAvailableDocs={isLoadingAvailableDocs}
              linkingDocId={linkingDocId}
              isSubmittingDoc={isSubmittingDoc}
              onLinkDoc={handleLinkDoc}
              onCreateAndLinkDoc={handleCreateAndLinkDoc}
              containerRef={docPickerRef}
            />
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
      <AttachmentDropzone
        isCardVariant={isCardVariant}
        isTaskTarget={isTaskTarget}
        totalItemsCount={totalItemsCount}
        isUploading={isUploading}
        isDraggingOver={isDraggingOver}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onDropzoneClick={() => fileInputRef.current?.click()}
      >
        <div
          className={`grid ${
            isCardVariant
              ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2"
              : "grid-cols-1 sm:grid-cols-2 gap-2"
          }`}
        >
          {/* 1. Linked Docs (if any) */}
          {isTaskTarget &&
            linkedDocs.map((doc) => (
              <LinkedDocCard
                key={`doc-${doc.id}`}
                doc={doc}
                isCardVariant={isCardVariant}
                isUnlinking={unlinkingDocId === doc.id}
                onUnlink={() => handleUnlinkDoc(doc.id)}
              />
            ))}

          {/* 2. Attached Files */}
          {attachments.map((attachment) => (
            <AttachmentCard
              key={`att-${attachment.id}`}
              attachment={attachment}
              isCardVariant={isCardVariant}
              entityLabel={entityLabel}
              isUnlinking={unlinkingAttachmentId === attachment.id}
              isDeleting={deletingAttachmentId === attachment.id}
              isConfirmingDelete={confirmDeleteId === attachment.id}
              onUnlink={() => handleUnlinkAttachment(attachment.id)}
              onRequestDelete={() => setConfirmDeleteId(attachment.id)}
              onConfirmDelete={() => handleDeleteAttachmentPermanently(attachment.id)}
              onCancelDelete={() => setConfirmDeleteId(null)}
            />
          ))}
        </div>
      </AttachmentDropzone>

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
