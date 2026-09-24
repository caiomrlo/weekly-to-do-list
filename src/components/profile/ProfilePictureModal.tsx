"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { X, Upload, Trash2, Loader2, Camera } from "lucide-react";
import { UserAvatar } from "@/components/shared/UserAvatar";
import {
  uploadUserAvatarAction,
  deleteUserAvatarAction,
} from "@/app/actions/user";

export interface ProfilePictureModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
  userName?: string;
  currentImage?: string | null;
  userAvatarColor?: string | null;
  userId?: string;
  onAvatarUpdated: (newImageUrl: string | null) => void;
}

const emptySubscribe = () => () => {};

export function ProfilePictureModal({
  isOpen,
  onClose,
  userEmail,
  userName,
  currentImage,
  userAvatarColor,
  userId,
  onAvatarUpdated,
}: ProfilePictureModalProps) {
  const isClient = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Clean up object URL on unmount or previewUrl change
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen && !isUploading && !isRemoving) {
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
        }
        onClose();
      }
    }

    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isUploading, isRemoving, onClose, previewUrl]);

  if (!isOpen || !isClient) return null;

  const handleCloseModal = () => {
    if (isUploading || isRemoving) return;
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrorMessage("Please select a valid image file (JPG, PNG, WebP, GIF, AVIF).");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage("Image size must be 5MB or less.");
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleCancelPreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setErrorMessage(null);
  };

  const handleSave = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setErrorMessage(null);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const res = await uploadUserAvatarAction(formData);

      if (res.error) {
        setErrorMessage(res.error);
        setIsUploading(false);
        return;
      }

      if (res.success && res.imageUrl) {
        onAvatarUpdated(res.imageUrl);
        window.dispatchEvent(
          new CustomEvent("user-avatar-updated", {
            detail: { image: res.imageUrl },
          })
        );
        onClose();
      }
    } catch (err) {
      console.error("Failed to upload avatar:", err);
      setErrorMessage("An unexpected error occurred while saving your avatar.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = async () => {
    setIsRemoving(true);
    setErrorMessage(null);

    try {
      const res = await deleteUserAvatarAction();

      if (res.error) {
        setErrorMessage(res.error);
        setIsRemoving(false);
        return;
      }

      if (res.success) {
        onAvatarUpdated(null);
        window.dispatchEvent(
          new CustomEvent("user-avatar-updated", {
            detail: { image: null },
          })
        );
        onClose();
      }
    } catch (err) {
      console.error("Failed to remove avatar:", err);
      setErrorMessage("An unexpected error occurred while removing your avatar.");
    } finally {
      setIsRemoving(false);
    }
  };

  const isBusy = isUploading || isRemoving;
  const effectiveDisplayImage = previewUrl ?? currentImage;
  const hasExistingImage = Boolean(currentImage);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleCloseModal();
        }
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-picture-title"
        className="w-full max-w-sm rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-neutral-800/80">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <h2
              id="profile-picture-title"
              className="text-sm font-semibold text-slate-900 dark:text-slate-100"
            >
              Profile Picture
            </h2>
          </div>

          <button
            type="button"
            onClick={handleCloseModal}
            disabled={isBusy}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer disabled:opacity-50"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 flex flex-col items-center">
          {/* Avatar Preview Display */}
          <div
            className={`relative group mb-5 ${!isBusy && !selectedFile ? "cursor-pointer" : ""}`}
            onClick={() => {
              if (!isBusy && !selectedFile) {
                fileInputRef.current?.click();
              }
            }}
            title={!selectedFile ? "Click to choose photo" : undefined}
          >
            <UserAvatar
              size="xl"
              name={userName}
              email={userEmail}
              image={effectiveDisplayImage}
              color={userAvatarColor}
              userId={userId}
              showBorder
              borderColor="border-slate-200 dark:border-neutral-700"
              className="shadow-md transition-transform group-hover:scale-105"
            />

            {/* Quick change camera badge (hidden while previewing a newly chosen file) */}
            {!isBusy && !selectedFile && (
              <div
                className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-amber-500 hover:bg-amber-600 text-white shadow-md border-2 border-white dark:border-neutral-900 flex items-center justify-center transition-all group-hover:scale-110 pointer-events-none"
                aria-hidden="true"
              >
                <Camera className="w-3.5 h-3.5" />
              </div>
            )}
          </div>

          {/* User Info Hint */}
          <div className="text-center mb-4">
            <div className="text-xs font-medium text-slate-800 dark:text-slate-200">
              {userName || userEmail.split("@")[0]}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              PNG, JPG, WebP, GIF or AVIF. Resized to 150×150.
            </div>
          </div>

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Error Message */}
          {errorMessage && (
            <div className="w-full mb-4 px-3 py-2 text-xs rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/60 text-center">
              {errorMessage}
            </div>
          )}

          {/* Action Buttons */}
          <div className="w-full space-y-2">
            {selectedFile ? (
              /* Staged Preview Actions */
              <div className="flex items-center gap-2 w-full">
                <button
                  type="button"
                  onClick={handleCancelPreview}
                  disabled={isBusy}
                  className="flex-1 px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-neutral-700 hover:bg-slate-50 dark:hover:bg-neutral-800 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer disabled:opacity-50 text-center"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isBusy}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-xl bg-amber-500 hover:bg-amber-600 text-white shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save picture</span>
                  )}
                </button>
              </div>
            ) : (
              /* Normal Actions */
              <>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isBusy}
                  className="w-full flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-medium rounded-xl bg-amber-500 hover:bg-amber-600 text-white shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{hasExistingImage ? "Change picture" : "Upload picture"}</span>
                </button>

                {hasExistingImage && (
                  <button
                    type="button"
                    onClick={handleRemove}
                    disabled={isBusy}
                    className="w-full flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-medium rounded-xl border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isRemoving ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-500" />
                        <span>Removing...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                        <span>Remove picture</span>
                      </>
                    )}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
