import { describe, it, expect } from "vitest";
import { createAgentTools } from "@/lib/ai/tools";
import { z } from "zod";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asZod = (schema: unknown) => schema as z.ZodObject<any>;

describe("ai-tools: createAgentTools", () => {
  const tools = createAgentTools({
    userId: "test-user-id",
    workspaceId: "test-workspace-id",
  });

  it("should initialize all required core agent tools", () => {
    expect(tools.listTasks).toBeDefined();
    expect(tools.createTask).toBeDefined();
    expect(tools.createTasksBatch).toBeDefined();
    expect(tools.updateTask).toBeDefined();
    expect(tools.deleteTask).toBeDefined();
    expect(tools.listProjects).toBeDefined();
    expect(tools.createProject).toBeDefined();
    expect(tools.listStatuses).toBeDefined();
  });

  describe("tool input schemas", () => {
    it("createTask schema should validate valid input and accept optional parameters", () => {
      const valid = asZod(tools.createTask.inputSchema).safeParse({
        title: "Deploy Next.js container",
        date: "2026-09-25",
        time: "10:00",
        duration: 45,
      });

      expect(valid.success).toBe(true);
      if (valid.success) {
        const data = valid.data as { title: string; duration: number };
        expect(data.title).toBe("Deploy Next.js container");
        expect(data.duration).toBe(45);
      }
    });

    it("createTasksBatch schema should parse array of task definitions", () => {
      const valid = asZod(tools.createTasksBatch.inputSchema).safeParse({
        tasks: [
          { title: "Task 1", date: "2026-09-25" },
          { title: "Task 2", date: null, duration: 30 },
        ],
      });

      expect(valid.success).toBe(true);
      if (valid.success) {
        const data = valid.data as { tasks: Array<{ title: string }> };
        expect(data.tasks).toHaveLength(2);
        expect(data.tasks[0].title).toBe("Task 1");
      }
    });

    it("updateTask schema should require taskId and allow partial updates", () => {
      const schema = asZod(tools.updateTask.inputSchema);
      const invalid = schema.safeParse({});
      expect(invalid.success).toBe(false);

      const valid = schema.safeParse({
        taskId: "task-123",
        completed: true,
        title: "Renamed Task",
      });
      expect(valid.success).toBe(true);
    });

    it("deleteTask schema should require taskId", () => {
      const schema = asZod(tools.deleteTask.inputSchema);
      expect(schema.safeParse({}).success).toBe(false);
      expect(schema.safeParse({ taskId: "task-999" }).success).toBe(true);
    });

    it("createProject schema should require name", () => {
      const schema = asZod(tools.createProject.inputSchema);
      expect(schema.safeParse({}).success).toBe(false);
      expect(schema.safeParse({ name: "Redesign", color: "indigo" }).success).toBe(true);
    });
  });
});
