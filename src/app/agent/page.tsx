import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  getAiThreadsAction,
  getAiThreadMessagesAction,
} from "@/app/actions/ai";
import { getUserPreferencesAction } from "@/app/actions/user";
import { getUserWorkspacesAction } from "@/app/actions/workspaces";
import { DEFAULT_USER_PREFERENCES, AiMessage } from "@/db/schema";
import { AgentWorkspace } from "@/components/agent/AgentWorkspace";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Agent | Weekly Planning",
  description: "Chat with your intelligent AI productivity assistant to plan, organize, and manage your weekly tasks.",
};

export default async function AgentPage() {
  const session = await getSessionUser();

  if (!session) {
    redirect("/login");
  }

  const [threadsRes, prefRes, workspacesRes] = await Promise.all([
    getAiThreadsAction(),
    getUserPreferencesAction(),
    getUserWorkspacesAction(),
  ]);

  const threads = threadsRes.threads || [];
  let initialMessages: AiMessage[] = [];
  let activeThreadId: string | undefined = undefined;

  if (threads.length > 0) {
    activeThreadId = threads[0].id;
    const msgRes = await getAiThreadMessagesAction(threads[0].id);
    initialMessages = msgRes.messages || [];
  }

  const initialPreferences = prefRes.preferences || DEFAULT_USER_PREFERENCES;
  const workspaces = workspacesRes.workspaces || [];
  const activeWorkspaceId = workspacesRes.activeWorkspaceId || "";

  return (
    <AgentWorkspace
      key={activeWorkspaceId}
      initialThreads={threads}
      initialMessages={initialMessages}
      initialActiveThreadId={activeThreadId}
      userEmail={session.email}
      userName={session.name}
      userImage={session.image}
      userAvatarColor={session.avatarColor}
      userId={session.userId}
      initialPreferences={initialPreferences}
      workspaces={workspaces}
      activeWorkspaceId={activeWorkspaceId}
    />
  );
}
