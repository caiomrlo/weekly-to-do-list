import { db } from "@/db";
import {
  tasks,
  recurringRules,
  Task,
  TaskWithTag,
  RecurrenceFrequency,
} from "@/db/schema";
import { and, eq, ne, gte, lte, or, isNull, inArray } from "drizzle-orm";
import {
  calculateProjectedDates,
  addDaysToStr,
  getDayOfWeekFromStr,
  parseDateParts,
} from "@/lib/recurrence-utils";
import { toDateString } from "@/lib/date-utils";
import { deleteTasksInternal } from "./task-cleanup";

export async function projectRecurringTasksForWindow(
  userId: string,
  workspaceId: string,
  startDate: string,
  endDate: string
): Promise<void> {
  const activeRules = await db
    .select()
    .from(recurringRules)
    .where(
      and(
        eq(recurringRules.userId, userId),
        eq(recurringRules.workspaceId, workspaceId),
        lte(recurringRules.startDate, endDate),
        or(isNull(recurringRules.endDate), gte(recurringRules.endDate, startDate))
      )
    );

  if (activeRules.length === 0) return;

  const ruleProjections: Array<{ rule: typeof activeRules[0]; dates: string[] }> = [];
  const allProjectedDatesSet = new Set<string>();
  const activeRuleIds = activeRules.map((r) => r.id);

  for (const rule of activeRules) {
    const dates = calculateProjectedDates(rule, startDate, endDate);
    if (dates.length > 0) {
      ruleProjections.push({ rule, dates });
      for (const d of dates) allProjectedDatesSet.add(d);
    }
  }

  if (ruleProjections.length === 0) return;

  const allProjectedDates = Array.from(allProjectedDatesSet);

  const existingTasks = await db
    .select({
      id: tasks.id,
      recurringRuleId: tasks.recurringRuleId,
      date: tasks.date,
      originalDate: tasks.originalDate,
    })
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, userId),
        eq(tasks.workspaceId, workspaceId),
        inArray(tasks.recurringRuleId, activeRuleIds),
        or(
          inArray(tasks.date, allProjectedDates),
          inArray(tasks.originalDate, allProjectedDates)
        )
      )
    );

  const existingKeySet = new Set<string>();
  for (const t of existingTasks) {
    if (t.recurringRuleId) {
      if (t.originalDate) existingKeySet.add(`${t.recurringRuleId}_${t.originalDate}`);
      if (t.date) existingKeySet.add(`${t.recurringRuleId}_${t.date}`);
    }
  }

  const tasksToInsert: Array<typeof tasks.$inferInsert> = [];
  const now = new Date();

  for (const { rule, dates } of ruleProjections) {
    for (const pDate of dates) {
      if (!existingKeySet.has(`${rule.id}_${pDate}`)) {
        tasksToInsert.push({
          workspaceId,
          userId,
          recurringRuleId: rule.id,
          originalDate: pDate,
          date: pDate,
          title: rule.title,
          content: rule.content,
          time: rule.time,
          duration: rule.duration,
          tagId: rule.tagId,
          projectId: rule.projectId,
          completed: false,
          order: 0,
          createdAt: now,
          updatedAt: now,
        });
        existingKeySet.add(`${rule.id}_${pDate}`);
      }
    }
  }

  if (tasksToInsert.length > 0) {
    await db.insert(tasks).values(tasksToInsert);
  }
}

export async function handleRecurringTaskFutureUpdate(
  currentTask: Task,
  data: {
    title?: string;
    content?: string;
    time?: string | null;
    duration?: number | null;
    tagId?: string | null;
    projectId?: string | null;
  },
  taskUpdateValues: Partial<typeof tasks.$inferInsert>,
  now: Date,
  userId: string
): Promise<void> {
  if (!currentTask.recurringRuleId) return;

  const currDate = currentTask.originalDate || currentTask.date;

  const ruleUpdateValues: Partial<typeof recurringRules.$inferInsert> = {
    updatedAt: now,
  };
  if (data.title !== undefined) ruleUpdateValues.title = data.title.trim();
  if (data.content !== undefined) ruleUpdateValues.content = data.content;
  if (data.time !== undefined) ruleUpdateValues.time = data.time ? data.time.trim() : null;
  if (data.duration !== undefined) ruleUpdateValues.duration = data.duration && data.duration > 0 ? data.duration : null;
  if (data.tagId !== undefined) ruleUpdateValues.tagId = data.tagId ? data.tagId : null;
  if (data.projectId !== undefined) ruleUpdateValues.projectId = data.projectId ? data.projectId : null;

  await db
    .update(recurringRules)
    .set(ruleUpdateValues)
    .where(
      and(
        eq(recurringRules.id, currentTask.recurringRuleId),
        eq(recurringRules.userId, userId)
      )
    );

  const futureUpdates: Partial<typeof tasks.$inferInsert> = { ...taskUpdateValues };
  delete futureUpdates.date;

  if (currDate) {
    await db
      .update(tasks)
      .set(futureUpdates)
      .where(
        and(
          eq(tasks.recurringRuleId, currentTask.recurringRuleId),
          eq(tasks.userId, userId),
          or(gte(tasks.date, currDate), gte(tasks.originalDate, currDate))
        )
      );
  }
}

export async function handleRecurringTaskDelete(
  task: Task,
  deleteScope: "this" | "future" | "all",
  userId: string
): Promise<void> {
  if (!task.recurringRuleId) {
    await deleteTasksInternal([task.id], userId);
    return;
  }

  const [rule] = await db
    .select()
    .from(recurringRules)
    .where(
      and(
        eq(recurringRules.id, task.recurringRuleId),
        eq(recurringRules.userId, userId)
      )
    );

  if (deleteScope === "all") {
    const allTasks = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(
        and(
          eq(tasks.recurringRuleId, task.recurringRuleId),
          eq(tasks.userId, userId)
        )
      );
    await deleteTasksInternal(
      allTasks.map((t) => t.id),
      userId
    );
    await db
      .delete(recurringRules)
      .where(
        and(
          eq(recurringRules.id, task.recurringRuleId),
          eq(recurringRules.userId, userId)
        )
      );
  } else if (deleteScope === "future") {
    const currDate = task.originalDate || task.date;
    if (currDate) {
      const futureTasks = await db
        .select({ id: tasks.id })
        .from(tasks)
        .where(
          and(
            eq(tasks.recurringRuleId, task.recurringRuleId),
            eq(tasks.userId, userId),
            or(gte(tasks.date, currDate), gte(tasks.originalDate, currDate))
          )
        );
      await deleteTasksInternal(
        futureTasks.map((t) => t.id),
        userId
      );

      if (rule) {
        const dayBefore = addDaysToStr(currDate, -1);
        if (dayBefore < rule.startDate) {
          await db
            .delete(recurringRules)
            .where(eq(recurringRules.id, rule.id));
        } else {
          await db
            .update(recurringRules)
            .set({ endDate: dayBefore, updatedAt: new Date() })
            .where(eq(recurringRules.id, rule.id));
        }
      }
    } else {
      await deleteTasksInternal([task.id], userId);
    }
  } else {
    // "this" occurrence only
    const currDate = task.originalDate || task.date;
    if (rule && currDate) {
      const currentExceptions = rule.exceptions || [];
      if (!currentExceptions.includes(currDate)) {
        await db
          .update(recurringRules)
          .set({
            exceptions: [...currentExceptions, currDate],
            updatedAt: new Date(),
          })
          .where(eq(recurringRules.id, rule.id));
      }
    }
    await deleteTasksInternal([task.id], userId);
  }
}

export async function updateTaskRecurrenceInternal(
  params: {
    taskId: string;
    frequency: RecurrenceFrequency | "none";
    interval?: number;
    daysOfWeek?: number[];
    dayOfMonth?: number;
    monthOfYear?: number;
    endDate?: string | null;
    currentWeekRange?: { startDate: string; endDate: string };
  },
  userId: string
): Promise<{
  targetTaskId: string;
  newTasks?: TaskWithTag[];
  deletedTaskIds?: string[];
}> {
  const [currentTask] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, params.taskId), eq(tasks.userId, userId)));

  if (!currentTask) {
    throw new Error("Task not found.");
  }

  const now = new Date();

  if (params.frequency === "none") {
    let deletedIds: string[] = [];
    if (currentTask.recurringRuleId) {
      const otherTasks = await db
        .select({ id: tasks.id })
        .from(tasks)
        .where(
          and(
            eq(tasks.recurringRuleId, currentTask.recurringRuleId),
            ne(tasks.id, currentTask.id),
            eq(tasks.userId, userId)
          )
        );
      deletedIds = otherTasks.map((t) => t.id);
      if (deletedIds.length > 0) {
        await deleteTasksInternal(deletedIds, userId);
      }

      await db
        .delete(recurringRules)
        .where(
          and(
            eq(recurringRules.id, currentTask.recurringRuleId),
            eq(recurringRules.userId, userId)
          )
        );

      await db
        .update(tasks)
        .set({
          recurringRuleId: null,
          originalDate: null,
          updatedAt: now,
        })
        .where(eq(tasks.id, currentTask.id));
    }

    return { targetTaskId: currentTask.id, deletedTaskIds: deletedIds };
  }

  // Setting or updating recurrence
  const baseDate = currentTask.date || toDateString(now);
  const defaultDay = getDayOfWeekFromStr(baseDate);
  const resolvedDays =
    params.frequency === "weekly"
      ? params.daysOfWeek && params.daysOfWeek.length > 0
        ? params.daysOfWeek
        : [defaultDay]
      : null;
  const resolvedDayOfMonth =
    params.frequency === "monthly" || params.frequency === "yearly"
      ? params.dayOfMonth || parseDateParts(baseDate).day
      : null;
  const resolvedMonthOfYear =
    params.frequency === "yearly"
      ? params.monthOfYear || parseDateParts(baseDate).month
      : null;

  let ruleId = currentTask.recurringRuleId;
  let deletedIds: string[] = [];

  if (ruleId) {
    // Update existing recurring rule
    await db
      .update(recurringRules)
      .set({
        frequency: params.frequency,
        interval: Math.max(1, params.interval || 1),
        daysOfWeek: resolvedDays,
        dayOfMonth: resolvedDayOfMonth,
        monthOfYear: resolvedMonthOfYear,
        startDate: baseDate,
        endDate: params.endDate || null,
        exceptions: [],
        title: currentTask.title,
        content: currentTask.content,
        time: currentTask.time,
        duration: currentTask.duration,
        tagId: currentTask.tagId,
        projectId: currentTask.projectId,
        updatedAt: now,
      })
      .where(
        and(
          eq(recurringRules.id, ruleId),
          eq(recurringRules.userId, userId)
        )
      );

    // Delete other tasks created from the old recurrence pattern
    const otherTasks = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(
        and(
          eq(tasks.recurringRuleId, ruleId),
          ne(tasks.id, currentTask.id),
          eq(tasks.userId, userId)
        )
      );
    deletedIds = otherTasks.map((t) => t.id);
    if (deletedIds.length > 0) {
      await deleteTasksInternal(deletedIds, userId);
    }

    // Update current task to reflect baseDate
    await db
      .update(tasks)
      .set({
        date: baseDate,
        originalDate: baseDate,
        updatedAt: now,
      })
      .where(eq(tasks.id, currentTask.id));
  } else {
    // Create new recurring rule
    const [newRule] = await db
      .insert(recurringRules)
      .values({
        workspaceId: currentTask.workspaceId,
        userId,
        frequency: params.frequency,
        interval: Math.max(1, params.interval || 1),
        daysOfWeek: resolvedDays,
        dayOfMonth: resolvedDayOfMonth,
        monthOfYear: resolvedMonthOfYear,
        startDate: baseDate,
        endDate: params.endDate || null,
        exceptions: [],
        title: currentTask.title,
        content: currentTask.content,
        time: currentTask.time,
        duration: currentTask.duration,
        tagId: currentTask.tagId,
        projectId: currentTask.projectId,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    ruleId = newRule.id;

    // Update current task
    await db
      .update(tasks)
      .set({
        date: baseDate,
        originalDate: baseDate,
        recurringRuleId: ruleId,
        updatedAt: now,
      })
      .where(eq(tasks.id, currentTask.id));
  }

  // Materialize occurrences for the current window if provided
  let newlyCreatedTasks: TaskWithTag[] = [];
  if (params.currentWeekRange && ruleId) {
    const [rule] = await db
      .select()
      .from(recurringRules)
      .where(eq(recurringRules.id, ruleId));

    if (rule) {
      const projectedDates = calculateProjectedDates(
        rule,
        params.currentWeekRange.startDate,
        params.currentWeekRange.endDate
      );
      const datesToMaterialize = projectedDates.filter((d) => d !== baseDate);

      if (datesToMaterialize.length > 0) {
        const inserted = await db
          .insert(tasks)
          .values(
            datesToMaterialize.map((d) => ({
              workspaceId: currentTask.workspaceId,
              userId,
              recurringRuleId: rule.id,
              originalDate: d,
              date: d,
              title: rule.title,
              content: rule.content,
              time: rule.time,
              duration: rule.duration,
              tagId: rule.tagId,
              projectId: rule.projectId,
              completed: false,
              order: 0,
              createdAt: now,
              updatedAt: now,
            }))
          )
          .returning();

        newlyCreatedTasks = inserted.map((ins) => ({
          ...ins,
          tag: null,
          project: null,
          parent: null,
          recurringRule: rule,
          subtaskCount: 0,
          completedSubtaskCount: 0,
          attachmentCount: 0,
          docCount: 0,
          assignees: [],
        }));
      }
    }
  }

  return {
    targetTaskId: currentTask.id,
    newTasks: newlyCreatedTasks,
    deletedTaskIds: deletedIds,
  };
}
