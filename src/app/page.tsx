import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getMondayOfWeek, toDateString } from "@/lib/date-utils";
import { getWeekTasksAction } from "@/app/actions/tasks";
import { getUserPreferencesAction } from "@/app/actions/user";
import { DEFAULT_USER_PREFERENCES } from "@/db/schema";
import { WeeklyBoard } from "@/components/WeeklyBoard";

export default async function HomePage() {
  const session = await getSessionUser();

  if (!session) {
    redirect("/login");
  }

  const monday = getMondayOfWeek(new Date());
  const sunday = new Date(
    monday.getFullYear(),
    monday.getMonth(),
    monday.getDate() + 6
  );

  const startStr = toDateString(monday);
  const endStr = toDateString(sunday);

  const [res, prefRes] = await Promise.all([
    getWeekTasksAction(startStr, endStr),
    getUserPreferencesAction(),
  ]);

  const initialTasks = res.tasks || [];
  const initialPreferences = prefRes.preferences || DEFAULT_USER_PREFERENCES;

  return (
    <WeeklyBoard
      initialTasks={initialTasks}
      userEmail={session.email}
      initialMondayStr={startStr}
      initialPreferences={initialPreferences}
    />
  );
}
