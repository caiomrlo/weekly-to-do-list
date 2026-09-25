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
    it("createTask schema should validate valid input and accept optional parameters including description", () => {
      const valid = asZod(tools.createTask.inputSchema).safeParse({
        title: "Deploy Next.js container",
        description: "Configure Dockerfile multi-stage build and verify health check.",
        date: "2026-09-25",
        time: "10:00",
        duration: 45,
      });

      expect(valid.success).toBe(true);
      if (valid.success) {
        const data = valid.data as { title: string; description?: string; duration: number };
        expect(data.title).toBe("Deploy Next.js container");
        expect(data.description).toBe("Configure Dockerfile multi-stage build and verify health check.");
        expect(data.duration).toBe(45);
      }
    });

    it("createTasksBatch schema should parse array of task definitions with optional description", () => {
      const valid = asZod(tools.createTasksBatch.inputSchema).safeParse({
        tasks: [
          { title: "Task 1", description: "First task details", date: "2026-09-25" },
          { title: "Task 2", date: null, duration: 30 },
        ],
      });

      expect(valid.success).toBe(true);
      if (valid.success) {
        const data = valid.data as { tasks: Array<{ title: string; description?: string }> };
        expect(data.tasks).toHaveLength(2);
        expect(data.tasks[0].title).toBe("Task 1");
        expect(data.tasks[0].description).toBe("First task details");
        expect(data.tasks[1].description).toBeUndefined();
      }
    });

    it("updateTask schema should require taskId and allow partial updates including description", () => {
      const schema = asZod(tools.updateTask.inputSchema);
      const invalid = schema.safeParse({});
      expect(invalid.success).toBe(false);

      const validWithDesc = schema.safeParse({
        taskId: "task-123",
        completed: true,
        title: "Renamed Task",
        description: "Updated description notes.",
      });
      expect(validWithDesc.success).toBe(true);
      if (validWithDesc.success) {
        expect(validWithDesc.data.description).toBe("Updated description notes.");
      }

      const validClearDesc = schema.safeParse({
        taskId: "task-123",
        description: null,
      });
      expect(validClearDesc.success).toBe(true);
      if (validClearDesc.success) {
        expect(validClearDesc.data.description).toBeNull();
      }
    });

    it("listTasks schema should accept optional taskId filter", () => {
      const schema = asZod(tools.listTasks.inputSchema);
      const valid = schema.safeParse({ taskId: "task-123" });
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
