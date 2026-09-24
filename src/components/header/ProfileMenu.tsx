"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, UserPen, LogOut } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { ProfilePictureModal } from "@/components/profile/ProfilePictureModal";
import { EditProfileModal } from "@/components/profile/EditProfileModal";

export interface ProfileMenuProps {
  userEmail: string;
  userName?: string;
  userImage?: string | null;
  userAvatarColor?: string | null;
  userId?: string;
}

export function ProfileMenu({
  userEmail,
  userName,
  userImage,
  userAvatarColor,
  userId,
}: ProfileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPictureModalOpen, setIsPictureModalOpen] = useState(false);
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);
  const [overrideImage, setOverrideImage] = useState<string | null | undefined>(undefined);
  const [overrideName, setOverrideName] = useState<string | undefined>(undefined);
  const currentImage = overrideImage !== undefined ? overrideImage : userImage;
  const currentName = overrideName !== undefined ? overrideName : userName;
  const menuRef = useRef<HTMLDivElement>(null);

  // Listen to global user avatar and profile update events
  useEffect(() => {
    function handleAvatarEvent(e: Event) {
      const customEvent = e as CustomEvent<{ image?: string | null }>;
      if (customEvent.detail && "image" in customEvent.detail) {
        setOverrideImage(customEvent.detail.image);
      }
    }

    function handleProfileEvent(e: Event) {
      const customEvent = e as CustomEvent<{ name?: string }>;
      if (customEvent.detail && "name" in customEvent.detail && customEvent.detail.name) {
        setOverrideName(customEvent.detail.name);
      }
    }

    window.addEventListener("user-avatar-updated", handleAvatarEvent);
    window.addEventListener("user-profile-updated", handleProfileEvent);
    return () => {
      window.removeEventListener("user-avatar-updated", handleAvatarEvent);
      window.removeEventListener("user-profile-updated", handleProfileEvent);
    };
  }, []);

  // Close profile menu on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const displayName = currentName?.trim() || userEmail.split("@")[0] || "User";

  return (
    <div className="relative" ref={menuRef}>
      {/* Avatar Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`rounded-full p-0.5 transition-all cursor-pointer flex items-center justify-center focus:outline-none ${
          isOpen
            ? "ring-2 ring-amber-500 dark:ring-amber-400 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 scale-105"
            : "hover:ring-2 hover:ring-slate-300 dark:hover:ring-slate-700 hover:scale-105"
        }`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="User profile menu"
        title={displayName}
      >
        <UserAvatar
          size="md"
          name={currentName}
          email={userEmail}
          image={currentImage}
          color={userAvatarColor}
          userId={userId}
          className="w-8 h-8 text-xs shrink-0"
        />
      </button>

      {/* Popover Card */}
      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          className="fixed inset-x-3.5 top-16 sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 sm:w-64 max-h-[calc(100dvh-5rem)] sm:max-h-none overflow-y-auto sm:overflow-visible p-2 rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 z-50 animate-in fade-in zoom-in-95 duration-150"
        >
          {/* User Information Header */}
          <div className="p-2.5 flex items-center gap-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl mb-1.5 border border-slate-100 dark:border-slate-800/80">
            <UserAvatar
              size="md"
              name={currentName}
              email={userEmail}
              image={currentImage}
              color={userAvatarColor}
              userId={userId}
              className="w-9 h-9 text-xs shrink-0"
            />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                {displayName}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {userEmail}
              </div>
            </div>
          </div>

          {/* Action Menu Items */}
          <div className="space-y-0.5">
            {/* Profile Picture Option */}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setIsOpen(false);
                setIsPictureModalOpen(true);
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer text-left"
            >
              <Camera className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
              <span>Profile picture</span>
            </button>

            {/* Edit Profile Option */}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setIsOpen(false);
                setIsEditProfileModalOpen(true);
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer text-left"
            >
              <UserPen className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
              <span>Edit profile</span>
            </button>

            {/* Divider */}
            <div className="h-px bg-slate-200/70 dark:bg-slate-800/70 my-1 mx-1" />

            {/* Logout Option */}
            <form action={logoutAction} className="w-full">
              <button
                type="submit"
                role="menuitem"
                className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer text-left group"
              >
                <LogOut className="w-4 h-4 text-rose-500 dark:text-rose-400 shrink-0 transition-transform group-hover:translate-x-0.5" />
                <span>Log out</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Profile Picture Management Modal */}
      {isPictureModalOpen && (
        <ProfilePictureModal
          isOpen={isPictureModalOpen}
          onClose={() => setIsPictureModalOpen(false)}
          userEmail={userEmail}
          userName={currentName}
          currentImage={currentImage}
          userAvatarColor={userAvatarColor}
          userId={userId}
          onAvatarUpdated={(newImageUrl) => setOverrideImage(newImageUrl)}
        />
      )}

      {/* Edit Profile Modal */}
      {isEditProfileModalOpen && (
        <EditProfileModal
          key={currentName || "edit-profile"}
          isOpen={isEditProfileModalOpen}
          onClose={() => setIsEditProfileModalOpen(false)}
          userEmail={userEmail}
          userName={currentName}
          onProfileUpdated={({ name: updatedName }) => setOverrideName(updatedName)}
        />
      )}
    </div>
  );
}
