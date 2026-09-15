import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getMondayOfWeek, toDateString, parseDateString } from "@/lib/date-utils";
import { getWeekTasksAction } from "@/app/actions/tasks";
import { getUserPreferencesAction } from "@/app/actions/user";
import { getUserWorkspacesAction } from "@/app/actions/workspaces";
import { DEFAULT_USER_PREFERENCES } from "@/db/schema";
import { WeeklyBoard } from "@/components/WeeklyBoard";
import { cookies } from "next/headers";

export default async function HomePage() {
  const session = await getSessionUser();

  if (!session) {
    redirect("/login");
  }

  const cookieStore = await cookies();
  const userTz = cookieStore.get("user_tz")?.value;

  let refDate = new Date();
  if (userTz) {
    try {
      const clientDateStr = new Intl.DateTimeFormat("en-CA", {
        timeZone: decodeURIComponent(userTz),
      }).format(new Date());
      refDate = parseDateString(clientDateStr);
    } catch {
      refDate = new Date();
    }
  }

  const monday = getMondayOfWeek(refDate);
  const sunday = new Date(
    monday.getFullYear(),
    monday.getMonth(),
    monday.getDate() + 6
  );

  const startStr = toDateString(monday);
  const endStr = toDateString(sunday);

  const [res, prefRes, workspacesRes] = await Promise.all([
    getWeekTasksAction(startStr, endStr),
    getUserPreferencesAction(),
    getUserWorkspacesAction(),
  ]);

  const initialTasks = res.tasks || [];
  const initialPreferences = prefRes.preferences || DEFAULT_USER_PREFERENCES;
  const workspaces = workspacesRes.workspaces || [];
  const activeWorkspaceId = workspacesRes.activeWorkspaceId || "";

  return (
    <WeeklyBoard
      key={activeWorkspaceId}
      initialTasks={initialTasks}
      userEmail={session.email}
      initialMondayStr={startStr}
      initialPreferences={initialPreferences}
      workspaces={workspaces}
      activeWorkspaceId={activeWorkspaceId}
    />
  );
}
