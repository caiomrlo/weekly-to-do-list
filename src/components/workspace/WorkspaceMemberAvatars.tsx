"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

interface MemberMock {
  id: string;
  name: string;
  role: string;
  type: "image" | "initial";
  avatarUrl?: string;
  initial?: string;
  bgColor?: string;
}

const MOCK_MEMBERS: MemberMock[] = [
  {
    id: "m1",
    name: "Alex Miller",
    role: "Admin",
    type: "image",
    avatarUrl:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&crop=faces&q=80",
    initial: "A",
  },
  {
    id: "m2",
    name: "Sarah Chen",
    role: "Member",
    type: "image",
    avatarUrl:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop&crop=faces&q=80",
    initial: "S",
  },
  {
    id: "m3",
    name: "Julia Santos",
    role: "Member",
    type: "initial",
    initial: "J",
    bgColor: "bg-indigo-500 text-white",
  },
  {
    id: "m4",
    name: "Lucas Lima",
    role: "Member",
    type: "initial",
    initial: "L",
    bgColor: "bg-teal-400 text-white",
  },
];

export function WorkspaceMemberAvatars() {
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  const handleImageError = (id: string) => {
    setImageErrors((prev) => ({ ...prev, [id]: true }));
  };

  return (
    <div className="flex items-center" aria-label="Workspace members">
      <div className="flex items-center -space-x-1.5 sm:-space-x-2">
        {MOCK_MEMBERS.map((member) => {
          const hasImageFailed = imageErrors[member.id];
          const showImage = member.type === "image" && member.avatarUrl && !hasImageFailed;

          return (
            <div
              key={member.id}
              className="relative group transition-transform hover:scale-110 hover:z-20 cursor-pointer"
              title={`${member.name} (${member.role})`}
            >
              {showImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={member.avatarUrl}
                  alt={member.name}
                  onError={() => handleImageError(member.id)}
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 border-white dark:border-slate-900 object-cover shadow-2xs"
                />
              ) : (
                <div
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center text-xs font-semibold shadow-2xs select-none ${
                    member.bgColor || "bg-amber-500 text-white"
                  }`}
                >
                  {member.initial || member.name.charAt(0)}
                </div>
              )}
            </div>
          );
        })}

        {/* Add Member Button (Mock Action) */}
        <button
          type="button"
          className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 border-white dark:border-slate-900 bg-white/90 hover:bg-white dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white shadow-2xs flex items-center justify-center cursor-pointer transition-all hover:scale-110 hover:z-20 group"
          title="Invite members (Coming soon)"
          aria-label="Invite members"
        >
          <Plus className="w-3.5 h-3.5 transition-transform group-hover:rotate-90 duration-200" />
        </button>
      </div>
    </div>
  );
}
