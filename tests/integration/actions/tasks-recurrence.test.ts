import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import {
  createTaskAction,
  getWeekTasksAction,
  updateTaskAction,
  toggleTaskStatusAction,
  deleteTaskAction,
  updateTaskRecurrenceAction,
} from "@/app/actions/tasks";
import { cleanupTestUser } from "../setup/test-db";
import {
  createTestUser,
  loginAsTestUser,
  logoutTestUser,
  TestUserData,
} from "../setup/auth-helper";

describe("Integration: Tasks Recurrence Actions", () => {
  let user: TestUserData;

  beforeEach(async () => {
    vi.clearAllMocks();
    logoutTestUser();
  });

  afterAll(async () => {
    if (user?.id) await cleanupTestUser(user.id);
  });

  it("materializes occurrences on-demand when loading a week", async () => {
    user = await createTestUser();
    await loginAsTestUser(user);

    // Create a base task on Monday 2026-09-14
    const created = await createTaskAction({
      title: "Daily Standup",
      date: "2026-09-14",
    });
    expect(created.task).toBeDefined();
    const taskId = created.task!.id;

    // Set recurrence to daily
    const recRes = await updateTaskRecurrenceAction({
      taskId,
      frequency: "daily",
      interval: 1,
      currentWeekRange: { startDate: "2026-09-14", endDate: "2026-09-20" },
    });
    expect(recRes.task).toBeDefined();
    expect(recRes.task!.recurringRuleId).toBeDefined();

    // Fetch the week tasks
    const weekRes = await getWeekTasksAction("2026-09-14", "2026-09-20");
    expect(weekRes.tasks).toBeDefined();

    const recurringStandups = weekRes.tasks!.filter(
      (t) => t.recurringRuleId === recRes.task!.recurringRuleId
    );
    expect(recurringStandups.length).toBe(7);
    const dates = recurringStandups.map((t) => t.date).sort();
    expect(dates).toEqual([
      "2026-09-14",
      "2026-09-15",
      "2026-09-16",
      "2026-09-17",
      "2026-09-18",
      "2026-09-19",
      "2026-09-20",
    ]);
  });

  it("preserves independent completion status across occurrences", async () => {
    user = await createTestUser();
    await loginAsTestUser(user);

    const created = await createTaskAction({
      title: "Workout",
      date: "2026-09-14",
    });
    const taskId = created.task!.id;

    await updateTaskRecurrenceAction({
      taskId,
      frequency: "daily",
      interval: 1,
      currentWeekRange: { startDate: "2026-09-14", endDate: "2026-09-20" },
    });

    const weekRes1 = await getWeekTasksAction("2026-09-14", "2026-09-20");
    const occurrences = weekRes1.tasks!.filter((t) => t.title === "Workout");
    expect(occurrences.length).toBe(7);

    // Toggle only Monday's occurrence
    const monOccurrence = occurrences.find((t) => t.date === "2026-09-14")!;
    await toggleTaskStatusAction(monOccurrence.id, true);

    // Re-query
    const weekRes2 = await getWeekTasksAction("2026-09-14", "2026-09-20");
    const updatedOccurrences = weekRes2.tasks!.filter((t) => t.title === "Workout");

    const updatedMon = updatedOccurrences.find((t) => t.date === "2026-09-14")!;
    const updatedTue = updatedOccurrences.find((t) => t.date === "2026-09-15")!;

    expect(updatedMon.completed).toBe(true);
    expect(updatedTue.completed).toBe(false);
  });

  it("updates task itself and deletes old occurrences when modifying recurrence", async () => {
    user = await createTestUser();
    await loginAsTestUser(user);

    // 1. Create a daily task
    const created = await createTaskAction({
      title: "Routine Check",
      date: "2026-09-14",
    });
    const taskId = created.task!.id;

    await updateTaskRecurrenceAction({
      taskId,
      frequency: "daily",
      interval: 1,
      currentWeekRange: { startDate: "2026-09-14", endDate: "2026-09-20" },
    });

    // Verify 7 occurrences exist
    const weekDaily = await getWeekTasksAction("2026-09-14", "2026-09-20");
    expect(weekDaily.tasks!.filter((t) => t.title === "Routine Check").length).toBe(7);

    // 2. Change recurrence of that same task from daily to weekly (Monday only)
    const updateRecRes = await updateTaskRecurrenceAction({
      taskId,
      frequency: "weekly",
      interval: 1,
      daysOfWeek: [1], // Monday only
      currentWeekRange: { startDate: "2026-09-14", endDate: "2026-09-20" },
    });

    // The task itself must be preserved (same ID)
    expect(updateRecRes.task!.id).toBe(taskId);
    expect(updateRecRes.task!.recurringRule?.frequency).toBe("weekly");

    // Re-fetch week: The other daily occurrences (Tue..Sun) must have been deleted!
    const weekWeekly = await getWeekTasksAction("2026-09-14", "2026-09-20");
    const weeklyCheckTasks = weekWeekly.tasks!.filter((t) => t.title === "Routine Check");
    expect(weeklyCheckTasks.length).toBe(1);
    expect(weeklyCheckTasks[0].date).toBe("2026-09-14");
    expect(weeklyCheckTasks[0].id).toBe(taskId);
  });

  it("supports edit scope: 'this' vs 'future'", async () => {
    user = await createTestUser();
    await loginAsTestUser(user);

    const created = await createTaskAction({
      title: "Sync Meeting",
      date: "2026-09-14",
    });
    const taskId = created.task!.id;

    await updateTaskRecurrenceAction({
      taskId,
      frequency: "daily",
      interval: 1,
      currentWeekRange: { startDate: "2026-09-14", endDate: "2026-09-20" },
    });

    const weekRes = await getWeekTasksAction("2026-09-14", "2026-09-20");
    const allSyncs = weekRes.tasks!.filter((t) => t.title === "Sync Meeting");
    const wedOccurrence = allSyncs.find((t) => t.date === "2026-09-16")!;

    // Edit Wednesday only with editScope: 'this'
    await updateTaskAction(wedOccurrence.id, {
      title: "Sync Meeting (Special)",
      editScope: "this",
    });

    const check1 = await getWeekTasksAction("2026-09-14", "2026-09-20");
    const wed1 = check1.tasks!.find((t) => t.date === "2026-09-16")!;
    const thu1 = check1.tasks!.find((t) => t.date === "2026-09-17")!;
    expect(wed1.title).toBe("Sync Meeting (Special)");
    expect(thu1.title).toBe("Sync Meeting");

    // Edit Thursday with editScope: 'future'
    await updateTaskAction(thu1.id, {
      title: "Team Sync (Future)",
      editScope: "future",
    });

    const check2 = await getWeekTasksAction("2026-09-14", "2026-09-20");
    const mon2 = check2.tasks!.find((t) => t.date === "2026-09-14")!;
    const thu2 = check2.tasks!.find((t) => t.date === "2026-09-17")!;
    const fri2 = check2.tasks!.find((t) => t.date === "2026-09-18")!;

    expect(mon2.title).toBe("Sync Meeting"); // past occurrence untouched
    expect(thu2.title).toBe("Team Sync (Future)"); // updated
    expect(fri2.title).toBe("Team Sync (Future)"); // propagated forward
  });

  it("supports delete scope: 'this' (adds exception), 'future', and 'all'", async () => {
    user = await createTestUser();
    await loginAsTestUser(user);

    const created = await createTaskAction({
      title: "Meditation",
      date: "2026-09-14",
    });
    const taskId = created.task!.id;

    await updateTaskRecurrenceAction({
      taskId,
      frequency: "daily",
      interval: 1,
      currentWeekRange: { startDate: "2026-09-14", endDate: "2026-09-20" },
    });

    let week = await getWeekTasksAction("2026-09-14", "2026-09-20");
    let medTasks = week.tasks!.filter((t) => t.title === "Meditation");
    expect(medTasks.length).toBe(7);

    // 1. Delete Tuesday with scope 'this'
    const tueTask = medTasks.find((t) => t.date === "2026-09-15")!;
    const delTue = await deleteTaskAction(tueTask.id, "this");
    expect(delTue.success).toBe(true);

    // Re-query: Tuesday should NOT be re-projected because it was added to exceptions
    week = await getWeekTasksAction("2026-09-14", "2026-09-20");
    medTasks = week.tasks!.filter((t) => t.title === "Meditation");
    expect(medTasks.find((t) => t.date === "2026-09-15")).toBeUndefined();
    expect(medTasks.length).toBe(6);

    // 2. Delete Friday with scope 'future' (Friday, Saturday, Sunday deleted)
    const friTask = medTasks.find((t) => t.date === "2026-09-18")!;
    const delFri = await deleteTaskAction(friTask.id, "future");
    expect(delFri.success).toBe(true);

    week = await getWeekTasksAction("2026-09-14", "2026-09-20");
    medTasks = week.tasks!.filter((t) => t.title === "Meditation");
    const remainingDates = medTasks.map((t) => t.date).sort();
    // Monday (14), Wednesday (16), Thursday (17) remain
    expect(remainingDates).toEqual(["2026-09-14", "2026-09-16", "2026-09-17"]);

    // 3. Delete Monday with scope 'all'
    const monTask = medTasks.find((t) => t.date === "2026-09-14")!;
    const delAll = await deleteTaskAction(monTask.id, "all");
    expect(delAll.success).toBe(true);

    week = await getWeekTasksAction("2026-09-14", "2026-09-20");
    medTasks = week.tasks!.filter((t) => t.title === "Meditation");
    expect(medTasks.length).toBe(0);
  });
});
