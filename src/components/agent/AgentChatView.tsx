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
  Square,
  Sparkles,
  CalendarDays,
  Inbox,
  CheckCircle2,
  Wrench,
  Check,
  PanelLeft,
  Cpu,
} from "lucide-react";

interface AgentChatViewProps {
  thread: AiThread;
  initialMessages: AiMessage[];
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
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
    <MessagePrimitive.Root className="flex justify-end my-3">
      <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-sm shadow-xs leading-relaxed select-text font-normal">
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
  <MarkdownTextPrimitive className="prose dark:prose-invert max-w-none text-sm text-slate-800 dark:text-slate-200" />
);

function AssistantMessage() {
  return (
    <MessagePrimitive.Root className="flex gap-3 my-4">
      <div className="w-8 h-8 rounded-xl bg-amber-500/10 dark:bg-amber-400/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20 mt-0.5">
        <Bot className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0 rounded-2xl px-4 py-3 bg-white dark:bg-neutral-800 border border-slate-200/80 dark:border-neutral-700/80 shadow-xs text-sm text-slate-800 dark:text-slate-200">
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
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="flex-1 flex flex-col h-full bg-slate-50/50 dark:bg-neutral-950/40 overflow-hidden">
        {/* Chat Header */}
        <div className="px-4 py-3 border-b border-slate-200/80 dark:border-neutral-800/80 flex items-center justify-between gap-3 bg-white/70 dark:bg-neutral-900/70 backdrop-blur-xs">
          <div className="flex items-center gap-2 min-w-0">
            {!isSidebarOpen && (
              <button
                type="button"
                onClick={onToggleSidebar}
                className="p-1.5 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer shrink-0"
                title="Open conversations sidebar"
                aria-label="Open conversations sidebar"
              >
                <PanelLeft className="w-4 h-4" />
              </button>
            )}

            <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>

            <div className="truncate">
              <h1 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                {thread.title}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-neutral-800 border border-slate-200/60 dark:border-neutral-700/60 text-[11px] font-medium text-slate-600 dark:text-slate-300">
              <Cpu className="w-3 h-3 text-amber-500" />
              <span>gpt-6-luna</span>
            </div>
          </div>
        </div>

        {/* Chat Thread Messages Surface */}
        <ThreadPrimitive.Root className="flex-1 flex flex-col min-h-0 relative">
          <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-8 py-6 scrollbar-thin">
            {/* Empty State with Starter Suggestions */}
            <ThreadPrimitive.Empty>
              <div className="max-w-xl mx-auto flex flex-col items-center justify-center py-10 px-4 text-center">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 text-white flex items-center justify-center shadow-lg shadow-amber-500/25 mb-4">
                  <Bot className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">
                  How can I help you today?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 max-w-md">
                  I can check your weekly tasks, schedule new items, plan complete projects, or update statuses in your workspace.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full text-left">
                  {STARTER_SUGGESTIONS.map((s) => {
                    const Icon = s.icon;
                    return (
                      <ThreadPrimitive.Suggestion
                        key={s.prompt}
                        prompt={s.prompt}
                        send
                        className="flex items-center gap-2.5 p-3 rounded-xl bg-white dark:bg-neutral-800/90 hover:bg-slate-50 dark:hover:bg-neutral-800 border border-slate-200/80 dark:border-neutral-700/80 shadow-2xs hover:border-amber-500/40 dark:hover:border-amber-500/40 text-xs text-slate-700 dark:text-slate-300 font-medium transition-all cursor-pointer group"
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
            </ThreadPrimitive.Empty>

            {/* Messages */}
            <ThreadPrimitive.Messages
              components={{
                UserMessage,
                AssistantMessage,
              }}
            />
          </ThreadPrimitive.Viewport>

          {/* Composer Input Bar */}
          <div className="p-3 sm:p-4 md:px-8 border-t border-slate-200/80 dark:border-neutral-800/80 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md">
            <ComposerPrimitive.Root className="relative flex items-end gap-2 bg-slate-100/90 dark:bg-neutral-800/90 rounded-2xl border border-slate-200/80 dark:border-neutral-700/80 p-2 focus-within:ring-2 focus-within:ring-amber-500/40 focus-within:border-amber-500/50 transition-all">
              <ComposerPrimitive.Input
                rows={1}
                autoFocus
                placeholder="Ask about your tasks or give instructions (e.g. 'What are my tasks for the week?')..."
                className="flex-1 max-h-36 resize-none bg-transparent px-2.5 py-1.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden"
              />
              <ComposerPrimitive.Send className="p-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-xs">
                <ArrowUp className="w-4 h-4" />
              </ComposerPrimitive.Send>
              <ComposerPrimitive.Cancel className="p-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition-colors cursor-pointer shadow-xs">
                <Square className="w-4 h-4 fill-current" />
              </ComposerPrimitive.Cancel>
            </ComposerPrimitive.Root>
            <p className="text-[11px] text-center text-slate-400 dark:text-slate-500 mt-2">
              The AI Agent has direct access to inspect and manage your active workspace tasks and projects.
            </p>
          </div>
        </ThreadPrimitive.Root>
      </div>
    </AssistantRuntimeProvider>
  );
}
