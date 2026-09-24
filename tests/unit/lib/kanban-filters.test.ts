import { describe, it, expect } from "vitest";
import {
  isTaskMatchingProjectFilter,
  isTaskMatchingDateFilter,
  filterKanbanTasks,
} from "@/lib/kanban-filter-utils";
import { TaskWithTag } from "@/db/schema";

function createMockTask(overrides: Partial<TaskWithTag> = {}): TaskWithTag {
  return {
    id: "task-1",
    workspaceId: "ws-1",
    userId: "user-1",
    tagId: null,
    projectId: null,
    statusId: "status-1",
    parentId: null,
    recurringRuleId: null,
    title: "Test Task",
    content: "",
    date: null,
    originalDate: null,
    time: null,
    duration: null,
    completed: false,
    order: 0,
    createdAt: new Date("2026-09-15T12:00:00Z"),
    updatedAt: new Date("2026-09-15T12:00:00Z"),
    tag: null,
    project: null,
    status: null,
    recurringRule: null,
    ...overrides,
  } as TaskWithTag;
}

describe("kanban-filter-utils", () => {
  describe("isTaskMatchingProjectFilter", () => {
    it("should match all tasks when projectFilter is 'all'", () => {
      const taskWithoutProj = createMockTask({ projectId: null });
      const taskWithProj = createMockTask({ projectId: "proj-1" });

      expect(isTaskMatchingProjectFilter(taskWithoutProj, "all")).toBe(true);
      expect(isTaskMatchingProjectFilter(taskWithProj, "all")).toBe(true);
    });

    it("should match only tasks without project when projectFilter is 'none'", () => {
      const taskWithoutProj = createMockTask({ projectId: null });
      const taskWithProj = createMockTask({ projectId: "proj-1" });

      expect(isTaskMatchingProjectFilter(taskWithoutProj, "none")).toBe(true);
      expect(isTaskMatchingProjectFilter(taskWithProj, "none")).toBe(false);
    });

    it("should match tasks with specific projectId", () => {
      const taskProj1 = createMockTask({ projectId: "proj-1" });
      const taskProj2 = createMockTask({ projectId: "proj-2" });
      const taskNoProj = createMockTask({ projectId: null });

      expect(isTaskMatchingProjectFilter(taskProj1, "proj-1")).toBe(true);
      expect(isTaskMatchingProjectFilter(taskProj2, "proj-1")).toBe(false);
      expect(isTaskMatchingProjectFilter(taskNoProj, "proj-1")).toBe(false);
    });
  });

  describe("isTaskMatchingDateFilter", () => {
    // Reference date: Saturday, 2026-09-19
    const refDate = new Date(2026, 8, 19, 12, 0, 0); // month is 0-indexed: 8 = September

    describe("all filter", () => {
      it("should always return true", () => {
        const oldTask = createMockTask({
          date: "2024-01-01",
          updatedAt: new Date("2024-01-01T00:00:00Z"),
          createdAt: new Date("2024-01-01T00:00:00Z"),
        });
        expect(isTaskMatchingDateFilter(oldTask, "all", refDate)).toBe(true);
      });
    });

    describe("today filter", () => {
      it("should match tasks scheduled for today", () => {
        const todayTask = createMockTask({ date: "2026-09-19" });
        const tomorrowTask = createMockTask({ date: "2026-09-20" });
        const yesterdayTask = createMockTask({ date: "2026-09-18" });

        expect(isTaskMatchingDateFilter(todayTask, "today", refDate)).toBe(true);
        expect(isTaskMatchingDateFilter(tomorrowTask, "today", refDate)).toBe(false);
        expect(isTaskMatchingDateFilter(yesterdayTask, "today", refDate)).toBe(false);
      });

      it("should match recurring projected tasks with originalDate today if date is unset", () => {
        const recurringToday = createMockTask({ date: null, originalDate: "2026-09-19" });
        const recurringTomorrow = createMockTask({ date: null, originalDate: "2026-09-20" });

        expect(isTaskMatchingDateFilter(recurringToday, "today", refDate)).toBe(true);
        expect(isTaskMatchingDateFilter(recurringTomorrow, "today", refDate)).toBe(false);
      });

      it("should match unscheduled tasks modified or created today", () => {
        const unscheduledToday = createMockTask({
          date: null,
          updatedAt: new Date("2026-09-19T08:30:00Z"),
        });
        const unscheduledPast = createMockTask({
          date: null,
          updatedAt: new Date("2026-09-18T20:00:00Z"),
          createdAt: new Date("2026-09-18T20:00:00Z"),
        });

        expect(isTaskMatchingDateFilter(unscheduledToday, "today", refDate)).toBe(true);
        expect(isTaskMatchingDateFilter(unscheduledPast, "today", refDate)).toBe(false);
      });
    });

    describe("default filter (+/- 30 days)", () => {
      it("should match tasks scheduled within +/- 30 days", () => {
        // Today is 2026-09-19. 30 days before is 2026-08-20. 30 days after is 2026-10-19.
        const taskInWindow = createMockTask({ date: "2026-09-25" });
        const task30DaysAgo = createMockTask({ date: "2026-08-21" });
        const taskPastOut = createMockTask({
          date: "2026-07-01",
          updatedAt: new Date("2026-07-01T00:00:00Z"),
          createdAt: new Date("2026-07-01T00:00:00Z"),
        });
        const taskFutureOut = createMockTask({
          date: "2026-11-01",
          updatedAt: new Date("2026-07-01T00:00:00Z"),
          createdAt: new Date("2026-07-01T00:00:00Z"),
        });

        expect(isTaskMatchingDateFilter(taskInWindow, "default", refDate)).toBe(true);
        expect(isTaskMatchingDateFilter(task30DaysAgo, "default", refDate)).toBe(true);
        expect(isTaskMatchingDateFilter(taskPastOut, "default", refDate)).toBe(false);
        expect(isTaskMatchingDateFilter(taskFutureOut, "default", refDate)).toBe(false);
      });

      it("should match tasks modified within the last 30 days even if date is outside", () => {
        const taskOldDateRecentUpdate = createMockTask({
          date: "2026-05-01",
          updatedAt: new Date("2026-09-18T10:00:00Z"),
          createdAt: new Date("2026-05-01T00:00:00Z"),
        });
        expect(isTaskMatchingDateFilter(taskOldDateRecentUpdate, "default", refDate)).toBe(true);
      });

      it("should match unscheduled tasks modified within the last 30 days", () => {
        const unscheduledRecent = createMockTask({
          date: null,
          updatedAt: new Date("2026-09-10T10:00:00Z"),
        });
        const unscheduledOld = createMockTask({
          date: null,
          updatedAt: new Date("2026-06-01T10:00:00Z"),
          createdAt: new Date("2026-06-01T10:00:00Z"),
        });

        expect(isTaskMatchingDateFilter(unscheduledRecent, "default", refDate)).toBe(true);
        expect(isTaskMatchingDateFilter(unscheduledOld, "default", refDate)).toBe(false);
      });
    });

    describe("this_week filter", () => {
      // 2026-09-19 is Saturday.
      // Monday of this week is 2026-09-14, Sunday is 2026-09-20.
      it("should match tasks scheduled in the current week", () => {
        const monTask = createMockTask({ date: "2026-09-14" });
        const wedTask = createMockTask({ date: "2026-09-16" });
        const sunTask = createMockTask({ date: "2026-09-20" });
        const prevSunTask = createMockTask({ date: "2026-09-13" });
        const nextMonTask = createMockTask({ date: "2026-09-21" });

        expect(isTaskMatchingDateFilter(monTask, "this_week", refDate)).toBe(true);
        expect(isTaskMatchingDateFilter(wedTask, "this_week", refDate)).toBe(true);
        expect(isTaskMatchingDateFilter(sunTask, "this_week", refDate)).toBe(true);
        expect(isTaskMatchingDateFilter(prevSunTask, "this_week", refDate)).toBe(false);
        expect(isTaskMatchingDateFilter(nextMonTask, "this_week", refDate)).toBe(false);
      });

      it("should match unscheduled tasks modified this week", () => {
        const unscheduledThisWeek = createMockTask({
          date: null,
          updatedAt: new Date("2026-09-15T08:00:00Z"),
        });
        const unscheduledLastWeek = createMockTask({
          date: null,
          updatedAt: new Date("2026-09-10T08:00:00Z"),
        });

        expect(isTaskMatchingDateFilter(unscheduledThisWeek, "this_week", refDate)).toBe(true);
        expect(isTaskMatchingDateFilter(unscheduledLastWeek, "this_week", refDate)).toBe(false);
      });
    });

    describe("this_month filter", () => {
      // Current month is September 2026 (2026-09-01 to 2026-09-30)
      it("should match tasks scheduled in the current month", () => {
        const firstDay = createMockTask({ date: "2026-09-01" });
        const midMonth = createMockTask({ date: "2026-09-15" });
        const lastDay = createMockTask({ date: "2026-09-30" });
        const augDay = createMockTask({ date: "2026-08-31" });
        const octDay = createMockTask({ date: "2026-10-01" });

        expect(isTaskMatchingDateFilter(firstDay, "this_month", refDate)).toBe(true);
        expect(isTaskMatchingDateFilter(midMonth, "this_month", refDate)).toBe(true);
        expect(isTaskMatchingDateFilter(lastDay, "this_month", refDate)).toBe(true);
        expect(isTaskMatchingDateFilter(augDay, "this_month", refDate)).toBe(false);
        expect(isTaskMatchingDateFilter(octDay, "this_month", refDate)).toBe(false);
      });

      it("should match unscheduled tasks modified this month", () => {
        const unscheduledThisMonth = createMockTask({
          date: null,
          updatedAt: new Date("2026-09-02T12:00:00Z"),
        });
        const unscheduledLastMonth = createMockTask({
          date: null,
          updatedAt: new Date("2026-08-25T12:00:00Z"),
        });

        expect(isTaskMatchingDateFilter(unscheduledThisMonth, "this_month", refDate)).toBe(true);
        expect(isTaskMatchingDateFilter(unscheduledLastMonth, "this_month", refDate)).toBe(false);
      });
    });
  });

  describe("filterKanbanTasks", () => {
    const refDate = new Date(2026, 8, 19, 12, 0, 0);

    it("should filter tasks combining both project and date criteria", () => {
      const task1 = createMockTask({
        id: "t1",
        projectId: "p1",
        date: "2026-09-16", // this week, project p1
      });
      const task2 = createMockTask({
        id: "t2",
        projectId: "p2",
        date: "2026-09-16", // this week, project p2
      });
      const task3 = createMockTask({
        id: "t3",
        projectId: "p1",
        date: "2026-07-01", // old, project p1
        updatedAt: new Date("2026-07-01T00:00:00Z"),
        createdAt: new Date("2026-07-01T00:00:00Z"),
      });

      const allList = [task1, task2, task3];

      // Filter: project p1, this_week -> only task1
      const filtered1 = filterKanbanTasks(allList, {
        projectFilter: "p1",
        dateFilter: "this_week",
        refDate,
      });
      expect(filtered1).toEqual([task1]);

      // Filter: project all, this_week -> task1, task2
      const filtered2 = filterKanbanTasks(allList, {
        projectFilter: "all",
        dateFilter: "this_week",
        refDate,
      });
      expect(filtered2).toEqual([task1, task2]);

      // Filter: project p1, all dates -> task1, task3
      const filtered3 = filterKanbanTasks(allList, {
        projectFilter: "p1",
        dateFilter: "all",
        refDate,
      });
      expect(filtered3).toEqual([task1, task3]);

      // Filter: project p1, today -> only todayTask
      const todayTask = createMockTask({
        id: "t-today",
        projectId: "p1",
        date: "2026-09-19",
      });
      const filteredToday = filterKanbanTasks([...allList, todayTask], {
        projectFilter: "p1",
        dateFilter: "today",
        refDate,
      });
      expect(filteredToday).toEqual([todayTask]);
    });
  });
});
