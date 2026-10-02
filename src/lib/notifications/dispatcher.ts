import { db } from "@/db";
import {
  users,
  tasks,
  taskAssignees,
  pushSubscriptions,
  notificationLogs,
} from "@/db/schema";
import { and, eq, inArray, isNotNull, or } from "drizzle-orm";
import { getUserLocalDateTime } from "./timezone";
import { sendPushToUser, PushNotificationPayload } from "./web-push-server";

export interface DispatchOptions {
  refDate?: Date;
  forceMorning?: boolean;
  dryRun?: boolean;
}

export interface DispatchResult {
  usersEvaluated: number;
  morningSummariesSent: number;
  morningSummariesSkipped: number;
  taskRemindersSent: number;
  taskRemindersSkipped: number;
  errors: string[];
}

export async function dispatchNotifications(
  options: DispatchOptions = {}
): Promise<DispatchResult> {
  const result: DispatchResult = {
    usersEvaluated: 0,
    morningSummariesSent: 0,
    morningSummariesSkipped: 0,
    taskRemindersSent: 0,
    taskRemindersSkipped: 0,
    errors: [],
  };

  const refDate = options.refDate || new Date();

  // Find all users who have at least one active push subscription
  const usersWithSubscriptions = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      preferences: users.preferences,
    })
    .from(users)
    .innerJoin(pushSubscriptions, eq(users.id, pushSubscriptions.userId))
    .groupBy(users.id);

  result.usersEvaluated = usersWithSubscriptions.length;

  for (const user of usersWithSubscriptions) {
    const prefs = user.preferences || {};
    const notifPrefs = prefs.notifications;

    // If master toggle is explicitly disabled, skip
    if (notifPrefs && notifPrefs.enabled === false) {
      continue;
    }

    const timezone = prefs.timezone || "UTC";
    const local = getUserLocalDateTime(timezone, refDate);

    // -------------------------------------------------------------------------
    // 1. Morning Daily Summary
    // -------------------------------------------------------------------------
    const morningEnabled = notifPrefs ? notifPrefs.morningDaily !== false : true;
    const targetMorningHour = notifPrefs?.morningHour ?? 8;
    const isMorningTime = options.forceMorning || local.hour === targetMorningHour;

    if (morningEnabled && isMorningTime) {
      try {
        // Check idempotency: has a morning summary already been logged for this user on this local date?
        const [existingLog] = await db
          .select({ id: notificationLogs.id })
          .from(notificationLogs)
          .where(
            and(
              eq(notificationLogs.userId, user.id),
              eq(notificationLogs.type, "morning_summary"),
              eq(notificationLogs.date, local.dateStr)
            )
          )
          .limit(1);

        if (existingLog) {
          result.morningSummariesSkipped++;
        } else {
          // Fetch user's uncompleted tasks for today (either created by user or assigned to user)
          const assignedTaskIdsSubquery = db
            .select({ taskId: taskAssignees.taskId })
            .from(taskAssignees)
            .where(eq(taskAssignees.userId, user.id));

          const dayTasks = await db
            .select({
              id: tasks.id,
              title: tasks.title,
              time: tasks.time,
            })
            .from(tasks)
            .where(
              and(
                eq(tasks.date, local.dateStr),
                eq(tasks.completed, false),
                or(
                  eq(tasks.userId, user.id),
                  inArray(tasks.id, assignedTaskIdsSubquery)
                )
              )
            );

          if (dayTasks.length > 0) {
            const taskCount = dayTasks.length;
            const payload: PushNotificationPayload = {
              title: `Good morning, ${user.name || "there"}!`,
              body: `You have ${taskCount} ${taskCount === 1 ? "task" : "tasks"} scheduled for today.`,
              url: `/?date=${local.dateStr}`,
              tag: `morning-summary-${local.dateStr}`,
            };

            if (!options.dryRun) {
              const sendResult = await sendPushToUser(user.id, payload);
              if (sendResult.successCount > 0) {
                try {
                  await db.insert(notificationLogs).values({
                    userId: user.id,
                    type: "morning_summary",
                    date: local.dateStr,
                    status: "sent",
                  });
                  result.morningSummariesSent++;
                } catch {
                  // Idempotency constraint protected against duplicate insertion
                  result.morningSummariesSkipped++;
                }
              }
            } else {
              result.morningSummariesSent++;
            }
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`User ${user.id} morning summary error: ${msg}`);
      }
    }

    // -------------------------------------------------------------------------
    // 2. Pre-task Reminder
    // -------------------------------------------------------------------------
    const taskRemindersEnabled = notifPrefs ? notifPrefs.taskReminders !== false : true;
    const leadMinutes = notifPrefs?.reminderMinutesBefore ?? 15;

    if (taskRemindersEnabled) {
      try {
        const assignedTaskIdsSubquery = db
          .select({ taskId: taskAssignees.taskId })
          .from(taskAssignees)
          .where(eq(taskAssignees.userId, user.id));

        const timedTasks = await db
          .select({
            id: tasks.id,
            title: tasks.title,
            time: tasks.time,
          })
          .from(tasks)
          .where(
            and(
              eq(tasks.date, local.dateStr),
              eq(tasks.completed, false),
              isNotNull(tasks.time),
              or(
                eq(tasks.userId, user.id),
                inArray(tasks.id, assignedTaskIdsSubquery)
              )
            )
          );

        const currentTotalMinutes = local.hour * 60 + local.minute;

        for (const task of timedTasks) {
          if (!task.time) continue;
          const [hStr, mStr] = task.time.split(":");
          const taskH = parseInt(hStr, 10);
          const taskM = parseInt(mStr, 10);
          if (isNaN(taskH) || isNaN(taskM)) continue;

          const taskTotalMinutes = taskH * 60 + taskM;
          const diffMinutes = taskTotalMinutes - currentTotalMinutes;

          // If task starts within the reminder window [0, leadMinutes]
          if (diffMinutes >= 0 && diffMinutes <= leadMinutes) {
            // Check idempotency: has a reminder already been logged for this task?
            const [existingLog] = await db
              .select({ id: notificationLogs.id })
              .from(notificationLogs)
              .where(
                and(
                  eq(notificationLogs.userId, user.id),
                  eq(notificationLogs.type, "task_reminder"),
                  eq(notificationLogs.taskId, task.id)
                )
              )
              .limit(1);

            if (existingLog) {
              result.taskRemindersSkipped++;
            } else {
              const diffText = diffMinutes === 0 ? "now" : `in ${diffMinutes} min`;
              const payload: PushNotificationPayload = {
                title: `Upcoming Task: ${task.title}`,
                body: `Starting ${diffText} (${task.time})`,
                url: `/?date=${local.dateStr}&taskId=${task.id}`,
                tag: `task-reminder-${task.id}`,
              };

              if (!options.dryRun) {
                const sendResult = await sendPushToUser(user.id, payload);
                if (sendResult.successCount > 0) {
                  try {
                    await db.insert(notificationLogs).values({
                      userId: user.id,
                      type: "task_reminder",
                      taskId: task.id,
                      status: "sent",
                    });
                    result.taskRemindersSent++;
                  } catch {
                    result.taskRemindersSkipped++;
                  }
                }
              } else {
                result.taskRemindersSent++;
              }
            }
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`User ${user.id} task reminder error: ${msg}`);
      }
    }
  }

  return result;
}
