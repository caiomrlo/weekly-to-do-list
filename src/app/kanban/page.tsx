import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getKanbanTasksAction } from "@/app/actions/tasks";
import { getWorkspaceTaskStatusesAction } from "@/app/actions/task-statuses";
import { getUserPreferencesAction } from "@/app/actions/user";
import { getUserWorkspacesAction } from "@/app/actions/workspaces";
import { DEFAULT_USER_PREFERENCES } from "@/db/schema";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";

export default async function KanbanPage() {
  const session = await getSessionUser();

  if (!session) {
    redirect("/login");
  }

  const [taskRes, statusRes, prefRes, workspacesRes] = await Promise.all([
    getKanbanTasksAction(),
    getWorkspaceTaskStatusesAction(),
    getUserPreferencesAction(),
    getUserWorkspacesAction(),
  ]);

  const initialTasks = taskRes.tasks || [];
  const initialStatuses = statusRes.statuses || [];
  const initialPreferences = prefRes.preferences || DEFAULT_USER_PREFERENCES;
  const workspaces = workspacesRes.workspaces || [];
  const activeWorkspaceId = workspacesRes.activeWorkspaceId || "";

  return (
    <KanbanBoard
      key={activeWorkspaceId}
      initialTasks={initialTasks}
      initialStatuses={initialStatuses}
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
