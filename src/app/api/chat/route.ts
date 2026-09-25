import { db } from "@/db";
import { aiThreads, aiMessages, taskStatuses, projects, tags } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { getActiveWorkspaceContext } from "@/lib/workspace";
import { buildAgentSystemPrompt } from "@/lib/ai/prompts";
import { createAgentTools } from "@/lib/ai/tools";
import { convertToModelMessages, streamText, isStepCount } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { and, eq, asc } from "drizzle-orm";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error:
          "OpenAI API key is missing. Please configure OPENAI_API_KEY in your environment (.env).",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  try {
    const { activeWorkspace } = await getActiveWorkspaceContext(session.userId);
    const body = await req.json();
    const { messages, threadId } = body;

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Invalid messages payload." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 1. Resolve or create active thread
    let activeThread = null;
    if (threadId) {
      const [existing] = await db
        .select()
        .from(aiThreads)
        .where(
          and(
            eq(aiThreads.id, threadId),
            eq(aiThreads.workspaceId, activeWorkspace.id),
            eq(aiThreads.userId, session.userId)
          )
        );
      activeThread = existing;
    }

    if (!activeThread) {
      const now = new Date();
      const [created] = await db
        .insert(aiThreads)
        .values({
          workspaceId: activeWorkspace.id,
          userId: session.userId,
          title: "New Chat",
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      activeThread = created;
    }

    // 2. Persist the newest user message if provided
    const lastUserMsg = messages
      .slice()
      .reverse()
      .find((m: { role: string }) => m.role === "user");

    if (lastUserMsg) {
      const userContent =
        typeof lastUserMsg.content === "string"
          ? lastUserMsg.content
          : Array.isArray(lastUserMsg.parts)
          ? lastUserMsg.parts
              .filter((p: { type: string; text?: string }) => p.type === "text")
              .map((p: { text?: string }) => p.text || "")
              .join("\n")
          : JSON.stringify(lastUserMsg.content || "");

      if (userContent.trim()) {
        await db.insert(aiMessages).values({
          threadId: activeThread.id,
          role: "user",
          content: userContent,
          parts: lastUserMsg.parts || null,
        });
      }
    }

    // 3. Gather workspace metadata for system prompt
    const [statusesList, projectsList, tagsList] = await Promise.all([
      db
        .select()
        .from(taskStatuses)
        .where(eq(taskStatuses.workspaceId, activeWorkspace.id))
        .orderBy(asc(taskStatuses.order)),
      db
        .select()
        .from(projects)
        .where(
          and(
            eq(projects.workspaceId, activeWorkspace.id),
            eq(projects.userId, session.userId)
          )
        )
        .orderBy(asc(projects.name)),
      db
        .select()
        .from(tags)
        .where(
          and(
            eq(tags.workspaceId, activeWorkspace.id),
            eq(tags.userId, session.userId)
          )
        )
        .orderBy(asc(tags.name)),
    ]);

    // 4. Resolve date/time in user's timezone
    const cookieStore = await cookies();
    const userTz = cookieStore.get("user_tz")?.value;
    let timezone = "UTC";
    if (userTz) {
      try {
        timezone = decodeURIComponent(userTz);
      } catch {
        timezone = "UTC";
      }
    }

    const now = new Date();
    let currentDateStr = now.toISOString().slice(0, 10);
    let currentDayOfWeek = "Thursday";
    let currentTime = "12:00";
    try {
      currentDateStr = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
      }).format(now);
      currentDayOfWeek = new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        timeZone: timezone,
      }).format(now);
      currentTime = new Intl.DateTimeFormat("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: timezone,
      }).format(now);
    } catch {
      // Keep defaults
    }

    const systemPrompt = buildAgentSystemPrompt({
      currentDate: currentDateStr,
      currentDayOfWeek,
      currentTime,
      userTimeZone: timezone,
      workspaceName: activeWorkspace.name,
      userName: session.name,
      statuses: statusesList.map((s) => ({
        id: s.id,
        name: s.name,
        category: s.category,
        isDefault: s.isDefault,
      })),
      projects: projectsList.map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
      })),
      tags: tagsList.map((t) => ({
        id: t.id,
        name: t.name,
        color: t.color,
      })),
    });

    const tools = createAgentTools({
      userId: session.userId,
      workspaceId: activeWorkspace.id,
    });

    const openai = createOpenAI({
      apiKey,
      baseURL: process.env.OPENAI_BASE_URL || undefined,
    });
    const modelName = process.env.OPENAI_MODEL || "gpt-6-luna";

    const currentThreadId = activeThread.id;
    const isNewChatTitle = activeThread.title === "New Chat";

    // 5. Execute streamText with Vercel AI SDK
    const result = streamText({
      model: openai(modelName),
      system: systemPrompt,
      messages: await convertToModelMessages(messages),
      tools,
      stopWhen: isStepCount(5),
    });

    const response = result.toUIMessageStreamResponse({
      onEnd: async ({ messages: finalMessages }) => {
        try {
          const lastMsg = finalMessages[finalMessages.length - 1];
          if (!lastMsg || lastMsg.role !== "assistant") return;

          const assistantText = lastMsg.parts
            .filter((p) => p.type === "text")
            .map((p) =>
              "text" in p && typeof p.text === "string" ? p.text : ""
            )
            .join("\n");

          await db.insert(aiMessages).values({
            threadId: currentThreadId,
            role: "assistant",
            content: assistantText,
            parts:
              Array.isArray(lastMsg.parts) && lastMsg.parts.length > 0
                ? lastMsg.parts
                : [{ type: "text", text: assistantText }],
          });

          const updates: { updatedAt: Date; title?: string } = {
            updatedAt: new Date(),
          };

          if (isNewChatTitle) {
            const firstUser = messages.find(
              (m: { role: string }) => m.role === "user"
            );
            const promptText =
              typeof firstUser?.content === "string"
                ? firstUser.content
                : Array.isArray(firstUser?.parts)
                ? firstUser.parts
                    .filter(
                      (p: { type: string; text?: string }) =>
                        p.type === "text" && typeof p.text === "string"
                    )
                    .map((p: { text?: string }) => p.text || "")
                    .join(" ")
                : "";

            if (promptText && promptText.trim()) {
              updates.title = promptText.trim().slice(0, 45);
            }
          }

          await db
            .update(aiThreads)
            .set(updates)
            .where(eq(aiThreads.id, currentThreadId));
        } catch (saveError) {
          console.error("Error saving assistant message to database:", saveError);
        }
      },
    });
    response.headers.set("X-Thread-Id", currentThreadId);
    return response;
  } catch (err: unknown) {
    console.error("Error in AI chat route:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Internal chat error.",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
