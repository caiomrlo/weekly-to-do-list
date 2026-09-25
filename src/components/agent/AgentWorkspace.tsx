"use client";

import { useState, useTransition } from "react";
import {
  AiThread,
  AiMessage,
  UserPreferences,
  DEFAULT_USER_PREFERENCES,
  BackgroundThemeId,
  Workspace,
} from "@/db/schema";
import {
  createAiThreadAction,
  deleteAiThreadAction,
  renameAiThreadAction,
  getAiThreadMessagesAction,
} from "@/app/actions/ai";
import { updateUserPreferencesAction } from "@/app/actions/user";
import { useDarkMode } from "@/lib/hooks/useDarkMode";
import { AppHeader } from "@/components/header/AppHeader";
import { MobileBottomNav } from "@/components/navigation/MobileBottomNav";
import { AgentThreadList } from "./AgentThreadList";
import { AgentChatView } from "./AgentChatView";
import { Bot, Plus, Loader2 } from "lucide-react";

interface AgentWorkspaceProps {
  initialThreads: AiThread[];
  initialMessages: AiMessage[];
  initialActiveThreadId?: string;
  userEmail: string;
  userName?: string;
  userImage?: string | null;
  userAvatarColor?: string | null;
  userId?: string;
  initialPreferences?: UserPreferences;
  workspaces?: Workspace[];
  activeWorkspaceId?: string;
}

export function AgentWorkspace({
  initialThreads,
  initialMessages,
  initialActiveThreadId,
  userEmail,
  userName,
  userImage,
  userAvatarColor,
  userId,
  initialPreferences,
  workspaces,
  activeWorkspaceId,
}: AgentWorkspaceProps) {
  const [threads, setThreads] = useState<AiThread[]>(initialThreads);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(
    initialActiveThreadId || (initialThreads.length > 0 ? initialThreads[0].id : null)
  );
  const [messages, setMessages] = useState<AiMessage[]>(initialMessages);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [preferences, setPreferences] = useState<UserPreferences>(
    initialPreferences || DEFAULT_USER_PREFERENCES
  );

  const isDarkMode = useDarkMode();

  const handleToggleTheme = async () => {
    const nextIsDark = !isDarkMode;
    if (nextIsDark) {
      document.documentElement.classList.add("dark");
      try {
        localStorage.setItem("theme", "dark");
        document.cookie = "theme=dark; path=/; max-age=31536000; SameSite=Lax";
      } catch {}
    } else {
      document.documentElement.classList.remove("dark");
      try {
        localStorage.setItem("theme", "light");
        document.cookie = "theme=light; path=/; max-age=31536000; SameSite=Lax";
      } catch {}
    }

    const nextTheme = nextIsDark ? "dark" : "light";
    try {
      await updateUserPreferencesAction({ theme: nextTheme });
    } catch (err) {
      console.error("Error saving theme preference:", err);
    }
  };

  const activeThread = threads.find((t) => t.id === activeThreadId) || null;

  const handleSelectThread = async (threadId: string) => {
    if (threadId === activeThreadId) return;
    setActiveThreadId(threadId);

    const res = await getAiThreadMessagesAction(threadId);
    if (res.messages) {
      setMessages(res.messages);
    } else {
      setMessages([]);
    }
  };

  const handleCreateThread = () => {
    startTransition(async () => {
      const res = await createAiThreadAction("New Chat");
      if (res.thread) {
        setThreads((prev) => [res.thread!, ...prev]);
        setActiveThreadId(res.thread.id);
        setMessages([]);
      }
    });
  };

  const handleDeleteThread = (threadId: string) => {
    startTransition(async () => {
      const res = await deleteAiThreadAction(threadId);
      if (res.success) {
        setThreads((prev) => {
          const next = prev.filter((t) => t.id !== threadId);
          if (activeThreadId === threadId) {
            if (next.length > 0) {
              setActiveThreadId(next[0].id);
              getAiThreadMessagesAction(next[0].id).then((mRes) => {
                setMessages(mRes.messages || []);
              });
            } else {
              setActiveThreadId(null);
              setMessages([]);
            }
          }
          return next;
        });
      }
    });
  };

  const handleRenameThread = (threadId: string, newTitle: string) => {
    startTransition(async () => {
      const res = await renameAiThreadAction(threadId, newTitle);
      if (res.thread) {
        setThreads((prev) =>
          prev.map((t) => (t.id === threadId ? { ...t, title: res.thread!.title } : t))
        );
      }
    });
  };

  const handleSelectBackground = (bgId: BackgroundThemeId) => {
    const nextPrefs: UserPreferences = { ...preferences, background: bgId };
    setPreferences(nextPrefs);
    updateUserPreferencesAction({ background: bgId }).catch((err) =>
      console.error("Failed to update background:", err)
    );
  };

  const bgTheme = preferences.background || "default";

  return (
    <div
      className={`h-[100dvh] flex flex-col theme-bg-${bgTheme} transition-colors duration-300 pb-16 md:pb-0 overflow-hidden`}
    >
      {/* Top Application Header */}
      <AppHeader
        className="mb-2 sm:mb-3"
        userEmail={userEmail}
        userName={userName}
        userImage={userImage}
        userAvatarColor={userAvatarColor}
        userId={userId}
        isDarkMode={isDarkMode}
        onToggleTheme={handleToggleTheme}
        preferences={preferences}
        onSelectBackground={handleSelectBackground}
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
      />

      {/* Main Agent Container: Expanded to full width and available height below header */}
      <main className="flex-1 min-h-0 flex px-2 sm:px-4 md:px-6 pb-2 sm:pb-3 w-full">
        <div className="flex-1 min-h-0 flex rounded-2xl md:rounded-3xl overflow-hidden border border-white/70 dark:border-neutral-800/80 bg-white/75 dark:bg-neutral-900/75 backdrop-blur-md shadow-xl dark:shadow-2xl dark:shadow-black/40">
          {/* Threads Sidebar */}
          <AgentThreadList
            threads={threads}
            activeThreadId={activeThreadId}
            onSelectThread={handleSelectThread}
            onCreateThread={handleCreateThread}
            onDeleteThread={handleDeleteThread}
            onRenameThread={handleRenameThread}
            isOpen={isSidebarOpen}
            isMobileOpen={isMobileSidebarOpen}
            onToggleOpen={() => setIsSidebarOpen((prev) => !prev)}
            onToggleMobileOpen={() => setIsMobileSidebarOpen((prev) => !prev)}
            isCreating={isPending}
          />

          {/* Active Chat Surface */}
          {activeThread ? (
            <AgentChatView
              key={activeThread.id}
              thread={activeThread}
              initialMessages={messages}
              isSidebarOpen={isSidebarOpen}
              onToggleSidebar={() => setIsSidebarOpen(true)}
              onToggleMobileSidebar={() => setIsMobileSidebarOpen(true)}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-8 text-center bg-transparent">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3 sm:mb-4">
                <Bot className="w-6 h-6 sm:w-7 sm:h-7" />
              </div>
              <h2 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">
                {threads.length === 0 ? "No conversations yet" : "No conversation selected"}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 sm:mb-5 max-w-sm px-4">
                {threads.length === 0
                  ? "Start a conversation to interact with your AI Agent, list tasks, schedule activities, and plan projects."
                  : "Choose a conversation from the sidebar or start a new one to continue."}
              </p>
              <button
                type="button"
                onClick={handleCreateThread}
                disabled={isPending}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                <span>New Conversation</span>
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />
    </div>
  );
}
