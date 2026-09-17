"use client";

import { useState } from "react";
import { getAvatarColorStyles } from "@/lib/avatar-utils";

export interface UserAvatarProps {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  color?: string | null;
  userId?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  showBorder?: boolean;
  borderColor?: string;
  className?: string;
  title?: string;
  alt?: string;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export function UserAvatar({
  name,
  email,
  image,
  color,
  userId,
  size = "md",
  showBorder = true,
  borderColor = "border-white dark:border-slate-900",
  className = "",
  title,
  alt,
  onClick,
}: UserAvatarProps) {
  const [hasImageError, setHasImageError] = useState(false);

  const initial = (
    name?.trim()?.charAt(0) ||
    email?.trim()?.charAt(0) ||
    "?"
  ).toUpperCase();

  const displayName = title ?? (name || email || "User");
  const colorStyles = getAvatarColorStyles(color, userId || email || undefined);
  const showImage = Boolean(image && !hasImageError);

  const sizeClasses = {
    xs: "w-4.5 h-4.5 text-[9px]",
    sm: "w-6 h-6 text-[10px]",
    md: "w-7 h-7 sm:w-8 sm:h-8 text-xs",
    lg: "w-9 h-9 sm:w-10 sm:h-10 text-sm",
    xl: "w-28 h-28 text-3xl",
  }[size];

  const borderThicknessClass =
    size === "xs" ? "border-[1.5px]" : size === "xl" ? "border-[3px]" : "border-2";

  return (
    <div
      onClick={onClick}
      className={`relative rounded-full shrink-0 flex items-center justify-center font-bold select-none overflow-hidden shadow-2xs ${sizeClasses} ${
        showBorder ? `${borderThicknessClass} ${borderColor}` : ""
      } ${
        !showImage ? colorStyles.bgClass : "bg-slate-100 dark:bg-slate-800"
      } ${className}`}
      title={displayName}
      aria-label={displayName}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image!}
          alt={alt || displayName}
          onError={() => setHasImageError(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <span className="uppercase leading-none">{initial}</span>
      )}
    </div>
  );
}
