"use client";

import { useState, useRef, useTransition } from "react";
import {
  AttachmentWithUrl,
  uploadAttachmentAction,
  deleteAttachmentAction,
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
} from "lucide-react";

interface TaskAttachmentsSectionProps {
  taskId: string;
  attachments: AttachmentWithUrl[];
  isLoading?: boolean;
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

export function TaskAttachmentsSection({
  taskId,
  attachments,
  isLoading = false,
  onAttachmentsChange,
}: TaskAttachmentsSectionProps) {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleUploadFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setUploadError(null);
    setIsUploading(true);

    const fileList = Array.from(files);
    const newAttachments: AttachmentWithUrl[] = [];

    try {
      for (const file of fileList) {
        const formData = new FormData();
        formData.append("taskId", taskId);
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
      console.error(err);
      setUploadError("Falha no envio do arquivo. Tente novamente.");
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

  const handleDelete = (attachmentId: string) => {
    setDeletingId(attachmentId);
    startTransition(async () => {
      try {
        const res = await deleteAttachmentAction(attachmentId);
        if (res.success) {
          onAttachmentsChange(attachments.filter((a) => a.id !== attachmentId));
        } else if (res.error) {
          setUploadError(res.error);
        }
      } catch (err) {
        console.error(err);
        setUploadError("Não foi possível excluir o anexo.");
      } finally {
        setDeletingId(null);
      }
    });
  };

  return (
    <div className="space-y-3">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Paperclip className="w-3.5 h-3.5" />
            Anexos
          </label>
          {attachments.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60">
              {attachments.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
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
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Anexar</span>
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
        className={`relative transition-all rounded-2xl border ${
          isDraggingOver
            ? "border-dashed border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40 scale-[1.01]"
            : attachments.length === 0
            ? "border-dashed border-slate-300/80 dark:border-slate-700/80 hover:border-indigo-400 dark:hover:border-indigo-500/70 bg-slate-50/40 dark:bg-slate-900/30 p-4 text-center cursor-pointer"
            : "border-transparent"
        }`}
      >
        {isUploading && (
          <div className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/50 border border-indigo-200/70 dark:border-indigo-800/70 text-indigo-600 dark:text-indigo-400 text-xs font-medium animate-pulse mb-3">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Enviando anexo para o Cloudflare R2...</span>
          </div>
        )}

        {/* Empty state: prompt to drag & drop or click */}
        {attachments.length === 0 && !isUploading && (
          <div className="flex flex-col items-center justify-center gap-1.5 text-slate-400 dark:text-slate-500">
            <UploadCloud className="w-6 h-6 stroke-[1.5] text-slate-400 dark:text-slate-500" />
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Arraste imagens ou PDFs aqui, ou clique para selecionar
            </p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              PNG, JPG, WebP, GIF ou PDF até 20MB
            </p>
          </div>
        )}

        {/* Attachments List / Grid */}
        {attachments.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {attachments.map((attachment) => {
              const isImage = attachment.contentType.startsWith("image/");
              const isDeletingThis = deletingId === attachment.id;

              return (
                <div
                  key={attachment.id}
                  className="group relative flex items-center gap-3 p-2 rounded-xl border border-slate-200/70 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/60 hover:bg-white dark:hover:bg-slate-900 transition-all hover:shadow-xs overflow-hidden"
                >
                  {/* Thumbnail / Icon (clique abre o arquivo original) */}
                  <a
                    href={attachment.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative w-11 h-11 rounded-lg overflow-hidden shrink-0 bg-slate-100 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50 flex items-center justify-center cursor-pointer transition-opacity hover:opacity-90"
                    title="Abrir arquivo original"
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
                        <FileText className="w-5 h-5" />
                        <span className="text-[9px] font-bold tracking-tighter uppercase mt-[-2px]">
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
                  <div className="flex items-center gap-1 shrink-0">
                    <a
                      href={attachment.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title="Abrir arquivo original em nova aba"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    <button
                      type="button"
                      onClick={() => handleDelete(attachment.id)}
                      disabled={isDeletingThis}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer disabled:opacity-50"
                      title="Excluir anexo"
                    >
                      {isDeletingThis ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-500" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
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
          Carregando anexos...
        </div>
      )}
    </div>
  );
}
