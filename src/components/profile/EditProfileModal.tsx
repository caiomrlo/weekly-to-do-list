"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { X, UserPen, User, Mail, Loader2 } from "lucide-react";
import { updateUserProfileNameAction } from "@/app/actions/user";

export interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
  userName?: string;
  onProfileUpdated?: (updated: { name: string }) => void;
}

const emptySubscribe = () => () => {};

export function EditProfileModal({
  isOpen,
  onClose,
  userEmail,
  userName = "",
  onProfileUpdated,
}: EditProfileModalProps) {
  const router = useRouter();
  const isClient = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const [name, setName] = useState(userName);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Autofocus input on open
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !isSaving) {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSaving, onClose]);

  if (!isOpen || !isClient) return null;

  const handleClose = () => {
    if (isSaving) return;
    onClose();
  };

  const hasChanges = name.trim() !== (userName || "").trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length < 2) {
      setErrorMessage("Name must be at least 2 characters long.");
      inputRef.current?.focus();
      return;
    }

    if (trimmedName.length > 100) {
      setErrorMessage("Name cannot exceed 100 characters.");
      inputRef.current?.focus();
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const res = await updateUserProfileNameAction(trimmedName);

      if (res.error) {
        setErrorMessage(res.error);
        setIsSaving(false);
        return;
      }

      // Notify other components via custom window event for real-time reactive sync
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("user-profile-updated", {
            detail: { name: trimmedName },
          })
        );
      }

      onProfileUpdated?.({ name: trimmedName });
      router.refresh();
      onClose();
    } catch (err) {
      console.error("Failed to update profile name:", err);
      setErrorMessage("An unexpected error occurred while saving your profile.");
    } finally {
      setIsSaving(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-profile-title"
        className="w-full max-w-md rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-neutral-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <UserPen className="w-4 h-4" />
            </div>
            <h2
              id="edit-profile-title"
              className="text-sm font-semibold text-slate-900 dark:text-slate-100"
            >
              Edit Profile
            </h2>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={isSaving}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer disabled:opacity-50"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body - Structured for future modular expansion */}
        <form onSubmit={handleSubmit}>
          <div className="p-5 space-y-4">
            {errorMessage && (
              <div className="p-3 text-xs bg-rose-50/80 dark:bg-rose-950/60 border border-rose-200/70 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 rounded-xl flex items-center gap-2">
                <span>⚠️</span>
                <span>{errorMessage}</span>
              </div>
            )}

            {/* General Profile Section */}
            <div className="space-y-3.5">
              <div>
                <label
                  htmlFor="profile-name-input"
                  className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5"
                >
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    ref={inputRef}
                    id="profile-name-input"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder="Enter your full name"
                    disabled={isSaving}
                    maxLength={100}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 bg-slate-50 dark:bg-neutral-800/60 border border-slate-200 dark:border-neutral-700/80 focus:border-amber-500 focus:bg-white dark:focus:bg-neutral-900 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="profile-email-readonly"
                  className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5"
                >
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="profile-email-readonly"
                    type="email"
                    value={userEmail}
                    readOnly
                    disabled
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm text-slate-500 dark:text-slate-400 bg-slate-100/70 dark:bg-neutral-800/30 border border-slate-200/60 dark:border-neutral-800 cursor-not-allowed select-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 bg-slate-50/70 dark:bg-neutral-800/40 border-t border-slate-100 dark:border-neutral-800">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSaving}
              className="px-3.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-neutral-800 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSaving || !hasChanges || name.trim().length === 0}
              className="px-4 py-2 text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 active:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-500 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
