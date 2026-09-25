"use client";

import { useMemo } from "react";
import { AiThread, AiMessage } from "@/db/schema";
import {
  AssistantRuntimeProvider,
  ThreadPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  type ToolCallMessagePartComponent,
} from "@assistant-ui/react";
import { MarkdownTextPrimitive } from "@assistant-ui/react-markdown";
import { useChatRuntime, AssistantChatTransport } from "@assistant-ui/react-ai-sdk";
import type { UIMessage } from "@ai-sdk/react";
import {
  Bot,
  ArrowUp,
  Sparkles,
  CalendarDays,
  Inbox,
  CheckCircle2,
  Wrench,
  Check,
  PanelLeft,
} from "lucide-react";
import { VoiceRecorderControl } from "./VoiceRecorderControl";

interface AgentChatViewProps {
  thread: AiThread;
  initialMessages: AiMessage[];
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  onToggleMobileSidebar?: () => void;
  onUpdateThreadTitle?: (threadId: string, newTitle: string) => void;
}

const STARTER_SUGGESTIONS = [
  {
    icon: CalendarDays,
    label: "What are my tasks this week?",
    prompt: "What are my tasks for this week?",
  },
  {
    icon: Sparkles,
    label: "Plan a new website project",
    prompt: "Create tasks for me to start a website launch project.",
  },
  {
    icon: Inbox,
    label: "Unscheduled backlog tasks",
    prompt: "Show my pending tasks in the unscheduled backlog.",
  },
  {
    icon: CheckCircle2,
    label: "What should I focus on today?",
    prompt: "What tasks should I focus on today?",
  },
];

function UserMessage() {
  return (
    <MessagePrimitive.Root className="flex justify-end my-2.5 sm:my-3">
      <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl px-3.5 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-xs sm:text-sm shadow-xs leading-relaxed select-text font-normal">
        <MessagePrimitive.Parts />
      </div>
    </MessagePrimitive.Root>
  );
}

const ToolCallFeedback: ToolCallMessagePartComponent = ({ toolName, status }) => {
  const isDone = status?.type === "complete";

  const getLabel = () => {
    switch (toolName) {
      case "listTasks":
        return "Searching tasks";
      case "createTask":
        return "Creating task";
      case "createTasksBatch":
        return "Creating tasks batch";
      case "updateTask":
        return "Updating task";
      case "deleteTask":
        return "Deleting task";
      case "listProjects":
        return "Checking projects";
      case "createProject":
        return "Creating project";
      case "listStatuses":
        return "Checking statuses";
      default:
        return `Executing ${toolName || "tool"}`;
    }
  };

  return (
    <div className="my-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-700/80 text-xs text-slate-600 dark:text-slate-300">
      <Wrench
        className={`w-3.5 h-3.5 ${
          isDone ? "text-emerald-500" : "text-amber-500 animate-pulse"
        }`}
      />
      <span className="font-medium">{getLabel()}</span>
      {isDone && <Check className="w-3.5 h-3.5 text-emerald-500 ml-0.5" />}
    </div>
  );
};

const MarkdownText = () => (
  <MarkdownTextPrimitive className="prose dark:prose-invert max-w-none text-xs sm:text-sm text-slate-800 dark:text-slate-200" />
);

function AssistantMessage() {
  return (
    <MessagePrimitive.Root className="flex gap-2.5 sm:gap-3 my-3 sm:my-4">
      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-amber-500/10 dark:bg-amber-400/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20 mt-0.5">
        <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      </div>
      <div className="flex-1 min-w-0 pt-0.5 text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
        <MessagePrimitive.Parts
          components={{
            Text: MarkdownText,
            tools: {
              Fallback: ToolCallFeedback,
            },
          }}
        />
      </div>
    </MessagePrimitive.Root>
  );
}

function getStringProp(obj: object, prop: string): string {
  if (prop in obj) {
    const val = (obj as Record<string, unknown>)[prop];
    if (typeof val === "string") return val;
  }
  return "";
}

function sanitizeUIParts(
  rawParts: unknown,
  fallbackContent: string | null
): UIMessage["parts"] {
  if (Array.isArray(rawParts) && rawParts.length > 0) {
    const validParts: UIMessage["parts"] = [];

    for (const item of rawParts) {
      if (!item || typeof item !== "object") continue;

      // Handle accidentally nested CoreMessage envelope { role: 'assistant', content: [...] }
      if (
        "role" in item &&
        "content" in item &&
        Array.isArray((item as { content: unknown[] }).content)
      ) {
        for (const subItem of (item as { content: unknown[] }).content) {
          if (
            subItem &&
            typeof subItem === "object" &&
            "type" in subItem &&
            typeof (subItem as { type: unknown }).type === "string"
          ) {
            const subType = (subItem as { type: string }).type;
            if (subType === "text") {
              validParts.push({
                type: "text",
                text: getStringProp(subItem, "text"),
              });
            } else if (subType === "reasoning") {
              validParts.push({
                type: "reasoning",
                text: getStringProp(subItem, "text"),
              });
            }
          }
        }
        continue;
      }

      // Valid UIMessage part MUST have a non-empty string `type`
      if (
        "type" in item &&
        typeof (item as { type: unknown }).type === "string" &&
        (item as { type: string }).type.length > 0
      ) {
        const itemType = (item as { type: string }).type;
        if (itemType === "text") {
          validParts.push({
            type: "text",
            text: getStringProp(item, "text"),
          });
        } else if (itemType === "reasoning") {
          validParts.push({
            type: "reasoning",
            text: getStringProp(item, "text"),
          });
        } else {
          validParts.push(item as unknown as UIMessage["parts"][number]);
        }
      }
    }

    if (validParts.length > 0) {
      return validParts;
    }
  }

  return [{ type: "text", text: fallbackContent || "" }];
}

export function AgentChatView({
  thread,
  initialMessages,
  isSidebarOpen,
  onToggleSidebar,
  onToggleMobileSidebar,
  onUpdateThreadTitle,
}: AgentChatViewProps) {
  const transport = useMemo(
    () =>
      new AssistantChatTransport({
        api: "/api/chat",
        body: { threadId: thread.id },
      }),
    [thread.id]
  );

  const convertedMessages: UIMessage[] = useMemo(() => {
    return initialMessages.map((m) => {
      const role: "user" | "assistant" | "system" =
        m.role === "assistant" || m.role === "user" || m.role === "system"
          ? m.role
          : "assistant";

      return {
        id: m.id,
        role,
        parts: sanitizeUIParts(m.parts, m.content),
      };
    });
  }, [initialMessages]);

  const runtime = useChatRuntime({
    transport,
    messages: convertedMessages,
    onFinish: async ({ messages: allMessages, isError, isAbort }) => {
      if (isError || isAbort) return;

      if (thread.title === "New Chat" && onUpdateThreadTitle) {
        const firstUser = allMessages.find((m) => m.role === "user");
        let promptText = "";
        if (firstUser) {
          if (Array.isArray(firstUser.parts)) {
            promptText = firstUser.parts
              .filter(
                (p): p is { type: "text"; text: string } =>
                  p.type === "text" &&
                  "text" in p &&
                  typeof (p as { text: unknown }).text === "string"
              )
              .map((p) => p.text)
              .join(" ");
          } else if (
            "content" in firstUser &&
            typeof (firstUser as Record<string, unknown>).content === "string"
          ) {
            promptText = (firstUser as Record<string, unknown>).content as string;
          }
        }

        const candidateTitle = promptText.trim().slice(0, 45);
        if (candidateTitle) {
          onUpdateThreadTitle(thread.id, candidateTitle);
        }
      }
    },
  });

  const handleToggleClick = () => {
    if (typeof window !== "undefined" && window.innerWidth < 768 && onToggleMobileSidebar) {
      onToggleMobileSidebar();
    } else {
      onToggleSidebar();
    }
  };

  const handleVoiceTranscript = (transcribedText: string) => {
    if (!transcribedText.trim()) return;
    const currentText = runtime.thread.composer.getState().text || "";
    const combined = currentText.trim()
      ? `${currentText.trim()} ${transcribedText.trim()}`
      : transcribedText.trim();
    runtime.thread.composer.setText(combined);
  };

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="flex-1 min-w-0 flex flex-col h-full bg-slate-50/20 dark:bg-neutral-950/20 overflow-hidden">
        {/* Chat Header */}
        <div className="px-3.5 sm:px-6 py-2.5 sm:py-3 border-b border-slate-200/60 dark:border-neutral-800/60 flex items-center justify-between gap-3 bg-white/40 dark:bg-neutral-900/40 backdrop-blur-xs shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={handleToggleClick}
              className={`p-1.5 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-white/60 dark:hover:bg-neutral-800/60 transition-colors cursor-pointer shrink-0 ${
                isSidebarOpen ? "flex md:hidden" : "flex"
              }`}
              title="Open conversations sidebar"
              aria-label="Open conversations sidebar"
            >
              <PanelLeft className="w-4 h-4" />
            </button>

            <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>

            <div className="truncate min-w-0">
              <h1 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                {thread.title}
              </h1>
            </div>
          </div>
        </div>

        {/* Chat Thread Messages Surface */}
        <ThreadPrimitive.Root className="flex-1 flex flex-col min-h-0 relative">
          <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto px-3 sm:px-6 md:px-8 py-4 sm:py-6 scrollbar-thin">
            <div className="max-w-4xl xl:max-w-5xl mx-auto w-full min-h-full flex flex-col">
              {/* Empty State with Starter Suggestions */}
              <ThreadPrimitive.Empty>
                <div className="flex-1 flex flex-col items-center justify-center my-auto py-6 sm:py-8 px-2 sm:px-4 text-center">
                  <div className="max-w-2xl w-full flex flex-col items-center justify-center">
                    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 text-white flex items-center justify-center shadow-lg shadow-amber-500/25 mb-3 sm:mb-4">
                      <Bot className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">
                      How can I help you today?
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-5 sm:mb-6 max-w-md">
                      I can check your weekly tasks, schedule new items, plan complete projects, or update statuses in your workspace.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5 w-full text-left">
                      {STARTER_SUGGESTIONS.map((s) => {
                        const Icon = s.icon;
                        return (
                          <ThreadPrimitive.Suggestion
                            key={s.prompt}
                            prompt={s.prompt}
                            send
                            className="flex items-center gap-2.5 p-2.5 sm:p-3 rounded-xl bg-white/80 dark:bg-neutral-800/80 hover:bg-white dark:hover:bg-neutral-800 border border-slate-200/80 dark:border-neutral-700/80 shadow-2xs hover:border-amber-500/40 dark:hover:border-amber-500/40 text-xs text-slate-700 dark:text-slate-300 font-medium transition-all cursor-pointer group"
                          >
                            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
                              <Icon className="w-3.5 h-3.5" />
                            </div>
                            <span className="truncate">{s.label}</span>
                          </ThreadPrimitive.Suggestion>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </ThreadPrimitive.Empty>

              {/* Messages */}
              <ThreadPrimitive.Messages
                components={{
                  UserMessage,
                  AssistantMessage,
                }}
              />
            </div>
          </ThreadPrimitive.Viewport>

          {/* Composer Input Bar */}
          <div className="p-2.5 sm:p-4 md:px-8 border-t border-slate-200/60 dark:border-neutral-800/60 bg-white/60 dark:bg-neutral-900/60 backdrop-blur-md shrink-0">
            <div className="max-w-4xl xl:max-w-5xl mx-auto w-full">
              <ComposerPrimitive.Root className="relative flex items-end gap-2 bg-slate-100 dark:bg-neutral-800 rounded-3xl pl-4 pr-1.5 py-1.5 sm:pr-2 sm:py-2 transition-all">
                <ComposerPrimitive.Input
                  rows={1}
                  autoFocus
                  placeholder="Ask about your tasks..."
                  className="flex-1 max-h-36 resize-none bg-transparent py-1.5 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden"
                />
                <VoiceRecorderControl onTranscript={handleVoiceTranscript} />
                <ComposerPrimitive.Send className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-amber-500 hover:bg-amber-600 text-white flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-xs shrink-0 self-end">
                  <ArrowUp className="w-4 h-4" />
                </ComposerPrimitive.Send>
              </ComposerPrimitive.Root>
            </div>
          </div>
        </ThreadPrimitive.Root>
      </div>
    </AssistantRuntimeProvider>
  );
}
