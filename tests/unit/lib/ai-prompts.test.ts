import { describe, it, expect } from "vitest";
import { buildAgentSystemPrompt, AgentPromptContext } from "@/lib/ai/prompts";

describe("ai-prompts: buildAgentSystemPrompt", () => {
  const baseContext: AgentPromptContext = {
    currentDate: "2026-09-25",
    currentDayOfWeek: "Friday",
    currentTime: "14:30",
    userTimeZone: "America/Sao_Paulo",
    workspaceName: "My Startup",
    userName: "Caio",
    statuses: [
      { id: "status-1", name: "To Do", category: "todo", isDefault: true },
      { id: "status-2", name: "Doing", category: "doing", isDefault: true },
      { id: "status-3", name: "Done", category: "done", isDefault: true },
    ],
    projects: [
      { id: "proj-1", name: "Marketing Site", color: "indigo" },
      { id: "proj-2", name: "Mobile App", color: "emerald" },
    ],
    tags: [
      { id: "tag-1", name: "Urgent", color: "rose" },
      { id: "tag-2", name: "Frontend", color: "sky" },
    ],
  };

  it("should inject runtime context correctly into prompt", () => {
    const prompt = buildAgentSystemPrompt(baseContext);

    expect(prompt).toContain("- **Today's Date**: 2026-09-25 (Friday)");
    expect(prompt).toContain("- **Current Time**: 14:30");
    expect(prompt).toContain("- **User Timezone**: America/Sao_Paulo");
    expect(prompt).toContain('- **Active Workspace**: "My Startup"');
    expect(prompt).toContain("- **User Name**: Caio");
  });

  it("should format task statuses catalog with ids and categories", () => {
    const prompt = buildAgentSystemPrompt(baseContext);

    expect(prompt).toContain('- "To Do" (ID: "status-1", Category: "todo", Default)');
    expect(prompt).toContain('- "Doing" (ID: "status-2", Category: "doing", Default)');
    expect(prompt).toContain('- "Done" (ID: "status-3", Category: "done", Default)');
  });

  it("should format projects and tags catalog", () => {
    const prompt = buildAgentSystemPrompt(baseContext);

    expect(prompt).toContain('- "Marketing Site" (ID: "proj-1", Color: "indigo")');
    expect(prompt).toContain('- "Mobile App" (ID: "proj-2", Color: "emerald")');
    expect(prompt).toContain('- "Urgent" (ID: "tag-1", Color: "rose")');
    expect(prompt).toContain('- "Frontend" (ID: "tag-2", Color: "sky")');
  });

  it("should display fallback messages when projects or tags are empty", () => {
    const emptyContext: AgentPromptContext = {
      ...baseContext,
      projects: [],
      tags: [],
    };

    const prompt = buildAgentSystemPrompt(emptyContext);

    expect(prompt).toContain("No projects created yet.");
    expect(prompt).toContain("No tags created yet.");
  });

  it("should fallback to 'User' when userName is omitted", () => {
    const noUserContext: AgentPromptContext = {
      ...baseContext,
      userName: undefined,
    };

    const prompt = buildAgentSystemPrompt(noUserContext);

    expect(prompt).toContain("- **User Name**: User");
  });

  it("should contain critical judgment guidelines for task descriptions", () => {
    const prompt = buildAgentSystemPrompt(baseContext);

    expect(prompt).toContain("Task Description Critical Judgment");
    expect(prompt).toContain("Tasks that REQUIRE a Description");
    expect(prompt).toContain("Tasks that DO NOT need a Description");
    expect(prompt).toContain("even if the user did not explicitly ask for a description");
  });

  it("should contain instructions for updating and editing task descriptions", () => {
    const prompt = buildAgentSystemPrompt(baseContext);

    expect(prompt).toContain("Task Updates & Descriptions");
    expect(prompt).toContain("You HAVE the full capability to add, edit, and update the description");
    expect(prompt).toContain("ALWAYS execute `updateTask`");
  });

  it("should contain intelligent naming rules for tasks and projects", () => {
    const prompt = buildAgentSystemPrompt(baseContext);

    expect(prompt).toContain("Intelligent Naming for Tasks & Projects");
    expect(prompt).toContain("Preserve Verbatim");
    expect(prompt).toContain("Intelligent Synthesis");
    expect(prompt).toContain("Strip Conversational Noise & Meta-phrases");
    expect(prompt).toContain("Project Naming Standards");
    expect(prompt).toContain("**NEVER** use informal all-lowercase names");
    expect(prompt).toContain("Project Context Awareness");
  });
});
