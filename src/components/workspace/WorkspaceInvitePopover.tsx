"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import {
  X,
  UserPlus,
  Link2,
  Copy,
  Check,
  RotateCcw,
  Mail,
  Loader2,
  Shield,
} from "lucide-react";
import {
  getWorkspaceInviteLinkAction,
  toggleWorkspaceInviteLinkAction,
  regenerateWorkspaceInviteLinkAction,
  getWorkspaceMembersAction,
  WorkspaceMemberItem,
} from "@/app/actions/workspace-invites";
import { UserAvatar } from "@/components/shared/UserAvatar";

export interface WorkspaceInvitePopoverProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  workspaceName?: string;
  onMembersUpdated?: () => void;
}

export function WorkspaceInvitePopover({
  isOpen,
  onClose,
  workspaceId,
  workspaceName = "Workspace",
  onMembersUpdated,
}: WorkspaceInvitePopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [linkEnabled, setLinkEnabled] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [members, setMembers] = useState<WorkspaceMemberItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isToggling, startToggleTransition] = useTransition();
  const [isRegenerating, startRegenerateTransition] = useTransition();

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Load data on open
  useEffect(() => {
    let isMounted = true;
    if (!isOpen || !workspaceId) return;

    void (async () => {
      try {
        const [linkRes, membersRes] = await Promise.all([
          getWorkspaceInviteLinkAction(workspaceId),
          getWorkspaceMembersAction(workspaceId),
        ]);

        if (!isMounted) return;

        if (linkRes.enabled && linkRes.token) {
          setLinkEnabled(true);
          setInviteToken(linkRes.token);
        } else {
          setLinkEnabled(false);
          setInviteToken(null);
        }

        if (membersRes.members) {
          setMembers(membersRes.members);
        }
      } catch (err) {
        console.error("Failed to load workspace invite data:", err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [isOpen, workspaceId]);

  const fullInviteUrl =
    typeof window !== "undefined" && inviteToken
      ? `${window.location.origin}/invite/${inviteToken}`
      : "";

  const handleCopy = async () => {
    if (!fullInviteUrl) return;
    try {
      await navigator.clipboard.writeText(fullInviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy invite link:", err);
    }
  };

  const handleToggleLink = () => {
    const nextState = !linkEnabled;
    startToggleTransition(async () => {
      const res = await toggleWorkspaceInviteLinkAction(workspaceId, nextState);
      if (res.success) {
        setLinkEnabled(Boolean(res.enabled));
        setInviteToken(res.token || null);
        onMembersUpdated?.();
      }
    });
  };

  const handleRegenerate = () => {
    startRegenerateTransition(async () => {
      const res = await regenerateWorkspaceInviteLinkAction(workspaceId);
      if (res.success && res.token) {
        setInviteToken(res.token);
        setLinkEnabled(true);
        onMembersUpdated?.();
      }
    });
  };

  if (!isOpen) return null;

  return (
    <div
      ref={popoverRef}
      className="absolute left-0 mt-2 w-80 sm:w-[380px] max-w-[calc(100vw-2rem)] rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 shadow-2xl p-4 z-50 flex flex-col gap-3.5 animate-in fade-in zoom-in-95 duration-150 text-slate-800 dark:text-neutral-100"
      role="dialog"
      aria-label="Invite members"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200/60 dark:border-neutral-800/60">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <UserPlus className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-semibold text-slate-800 dark:text-neutral-100 truncate">
            Invite to {workspaceName}
          </span>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-neutral-200 hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {isLoading ? (
        <div className="py-6 flex flex-col items-center justify-center gap-1.5 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
          <span className="text-[11px]">Loading invite options...</span>
        </div>
      ) : (
        <>
          {/* 1. Shareable Invite Link */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-neutral-300">
                <Link2 className="w-3.5 h-3.5 text-amber-500" />
                <span>Invite link</span>
              </div>

              {/* Toggle Switch */}
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={linkEnabled}
                  onChange={handleToggleLink}
                  disabled={isToggling}
                  className="sr-only peer"
                />
                <div className="w-8 h-4.5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-amber-500"></div>
                <span className="ml-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {isToggling ? "..." : linkEnabled ? "On" : "Off"}
                </span>
              </label>
            </div>

            {linkEnabled && fullInviteUrl ? (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    readOnly
                    value={fullInviteUrl}
                    className="flex-1 bg-slate-50 dark:bg-neutral-800/80 border border-slate-200 dark:border-neutral-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 dark:text-neutral-200 select-all font-mono focus:outline-none truncate"
                  />
                  <button
                    type="button"
                    onClick={handleCopy}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1 shrink-0 cursor-pointer shadow-xs ${
                      copied
                        ? "bg-emerald-500 text-white"
                        : "bg-amber-500 hover:bg-amber-600 text-white"
                    }`}
                  >
                    {copied ? (
                      <>
                        <Check className="w-3 h-3" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 px-0.5">
                  <span>Anyone with this link can join</span>
                  <button
                    type="button"
                    onClick={handleRegenerate}
                    disabled={isRegenerating}
                    className="text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 flex items-center gap-1 cursor-pointer transition-colors"
                    title="Reset link"
                  >
                    <RotateCcw
                      className={`w-2.5 h-2.5 ${
                        isRegenerating ? "animate-spin" : ""
                      }`}
                    />
                    <span>{isRegenerating ? "Resetting..." : "Reset"}</span>
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                Invite link is off. Turn on to generate a shareable link.
              </p>
            )}
          </div>

          {/* 2. Invite by Email (Prepared for future) */}
          <div className="pt-2 border-t border-slate-100 dark:border-neutral-800/80 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-medium text-slate-700 dark:text-slate-300">
              <div className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>Invite by email</span>
              </div>
              <span className="text-[9px] uppercase px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-neutral-800 text-slate-400 dark:text-slate-500 font-semibold tracking-wider">
                Coming soon
              </span>
            </div>

            <div className="flex items-center gap-1.5 opacity-50 pointer-events-none">
              <input
                type="email"
                disabled
                placeholder="colleague@example.com"
                className="flex-1 bg-slate-50 dark:bg-neutral-800/80 border border-slate-200 dark:border-neutral-700 rounded-xl px-2.5 py-1 text-xs text-slate-500"
              />
              <button
                type="button"
                disabled
                className="px-2.5 py-1 rounded-xl bg-slate-200 dark:bg-neutral-700 text-slate-400 text-xs font-medium"
              >
                Send
              </button>
            </div>
          </div>

          {/* 3. Members List */}
          <div className="pt-2 border-t border-slate-100 dark:border-neutral-800/80 space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Members ({members.length})
            </span>

            <div className="space-y-1 max-h-36 overflow-y-auto pr-0.5">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between py-1 px-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-neutral-800/50 transition-colors text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <UserAvatar
                      size="sm"
                      name={member.name}
                      email={member.email}
                      image={member.image}
                      color={member.avatarColor}
                      userId={member.userId}
                      showBorder={false}
                      className="w-5 h-5 text-[10px]"
                    />

                    <span className="font-medium text-slate-700 dark:text-slate-200 truncate">
                      {member.name}
                    </span>

                    {member.isCurrentUser && (
                      <span className="text-[9px] px-1 py-0.2 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-medium">
                        You
                      </span>
                    )}
                  </div>

                  <div className="flex items-center shrink-0">
                    {member.isOwner ? (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded-full border border-amber-200/50 dark:border-amber-900/40">
                        <Shield className="w-2.5 h-2.5" />
                        Owner
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded-full">
                        Member
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
