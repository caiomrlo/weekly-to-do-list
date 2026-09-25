import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import {
  getAiThreadsAction,
  getAiThreadAction,
  createAiThreadAction,
  getAiThreadMessagesAction,
  deleteAiThreadAction,
  renameAiThreadAction,
} from "@/app/actions/ai";
import { db, cleanupTestUser } from "../setup/test-db";
import {
  createTestUser,
  loginAsTestUser,
  logoutTestUser,
  TestUserData,
} from "../setup/auth-helper";
import { aiThreads, aiMessages } from "@/db/schema";
import { eq } from "drizzle-orm";

describe("Integration: AI Actions", () => {
  let userA: TestUserData;
  let userB: TestUserData;

  beforeEach(async () => {
    vi.clearAllMocks();
    logoutTestUser();
  });

  afterAll(async () => {
    if (userA?.id) await cleanupTestUser(userA.id);
    if (userB?.id) await cleanupTestUser(userB.id);
  });

  describe("Authentication Guard", () => {
    it("should reject all actions when not authenticated", async () => {
      const getThreadsRes = await getAiThreadsAction();
      expect(getThreadsRes.error).toBe("Not authenticated.");

      const getThreadRes = await getAiThreadAction("some-thread-id");
      expect(getThreadRes.error).toBe("Not authenticated.");

      const createRes = await createAiThreadAction("Test");
      expect(createRes.error).toBe("Not authenticated.");

      const getMsgsRes = await getAiThreadMessagesAction("some-thread-id");
      expect(getMsgsRes.error).toBe("Not authenticated.");

      const deleteRes = await deleteAiThreadAction("some-thread-id");
      expect(deleteRes.error).toBe("Not authenticated.");

      const renameRes = await renameAiThreadAction("some-thread-id", "New Title");
      expect(renameRes.error).toBe("Not authenticated.");
    });
  });

  describe("createAiThreadAction & getAiThreadsAction", () => {
    it("should create a new thread with default title and list it", async () => {
      userA = await createTestUser();
      await loginAsTestUser(userA);

      const createRes = await createAiThreadAction();
      expect(createRes.thread).toBeDefined();
      expect(createRes.thread?.title).toBe("New Chat");
      expect(createRes.thread?.userId).toBe(userA.id);

      const listRes = await getAiThreadsAction();
      expect(listRes.threads).toBeDefined();
      expect(listRes.threads?.some((t) => t.id === createRes.thread!.id)).toBe(true);
    });

    it("should create thread with custom title and trim whitespace", async () => {
      userA = await createTestUser();
      await loginAsTestUser(userA);

      const createRes = await createAiThreadAction("   Sprint Planning   ");
      expect(createRes.thread?.title).toBe("Sprint Planning");
    });
  });

  describe("getAiThreadAction", () => {
    it("should retrieve a single thread by id for authenticated user", async () => {
      userA = await createTestUser();
      await loginAsTestUser(userA);

      const createRes = await createAiThreadAction("Detailed Thread");
      const threadId = createRes.thread!.id;

      const getRes = await getAiThreadAction(threadId);
      expect(getRes.thread).toBeDefined();
      expect(getRes.thread?.id).toBe(threadId);
      expect(getRes.thread?.title).toBe("Detailed Thread");
    });

    it("should return error when thread does not exist or has invalid id", async () => {
      userA = await createTestUser();
      await loginAsTestUser(userA);

      const invalidRes = await getAiThreadAction("non-existent-id");
      expect(invalidRes.error).toBe("Conversation not found.");

      const nonExistentRes = await getAiThreadAction(
        "00000000-0000-0000-0000-000000000000"
      );
      expect(nonExistentRes.error).toBe("Conversation not found.");
    });

    it("should prevent User B from reading User A's thread via getAiThreadAction", async () => {
      userA = await createTestUser();
      userB = await createTestUser();

      await loginAsTestUser(userA);
      const created = await createAiThreadAction("User A Private");
      const threadId = created.thread!.id;

      await loginAsTestUser(userB);
      const getRes = await getAiThreadAction(threadId);
      expect(getRes.error).toBe("Conversation not found.");
      expect(getRes.thread).toBeUndefined();
    });
  });

  describe("renameAiThreadAction", () => {
    it("should reject empty or whitespace title", async () => {
      userA = await createTestUser();
      await loginAsTestUser(userA);

      const created = await createAiThreadAction("Initial Name");
      const threadId = created.thread!.id;

      const renameRes = await renameAiThreadAction(threadId, "   ");
      expect(renameRes.error).toBe("Title cannot be empty.");
    });

    it("should successfully rename user's own thread", async () => {
      userA = await createTestUser();
      await loginAsTestUser(userA);

      const created = await createAiThreadAction("Initial Name");
      const threadId = created.thread!.id;

      const renameRes = await renameAiThreadAction(threadId, "Project Kickoff");
      expect(renameRes.thread?.title).toBe("Project Kickoff");

      const [updated] = await db
        .select()
        .from(aiThreads)
        .where(eq(aiThreads.id, threadId));
      expect(updated.title).toBe("Project Kickoff");
    });

    it("should prevent User B from renaming User A's thread", async () => {
      userA = await createTestUser();
      userB = await createTestUser();

      await loginAsTestUser(userA);
      const created = await createAiThreadAction("User A Private Chat");
      const threadId = created.thread!.id;

      await loginAsTestUser(userB);
      const renameRes = await renameAiThreadAction(threadId, "Hijacked Name");
      expect(renameRes.error).toBe("Conversation not found.");

      const [check] = await db
        .select()
        .from(aiThreads)
        .where(eq(aiThreads.id, threadId));
      expect(check.title).toBe("User A Private Chat");
    });
  });

  describe("getAiThreadMessagesAction & deleteAiThreadAction", () => {
    it("should fetch messages chronologically and cascade delete on thread deletion", async () => {
      userA = await createTestUser();
      await loginAsTestUser(userA);

      const created = await createAiThreadAction("Chat with Messages");
      const threadId = created.thread!.id;

      const now = new Date();
      // Insert user message and assistant message
      await db.insert(aiMessages).values([
        {
          threadId,
          role: "user",
          content: "First question",
          createdAt: new Date(now.getTime() - 1000),
        },
        {
          threadId,
          role: "assistant",
          content: "First response",
          createdAt: now,
        },
      ]);

      const msgsRes = await getAiThreadMessagesAction(threadId);
      expect(msgsRes.messages).toHaveLength(2);
      expect(msgsRes.messages?.[0].content).toBe("First question");
      expect(msgsRes.messages?.[1].content).toBe("First response");

      // Delete thread
      const deleteRes = await deleteAiThreadAction(threadId);
      expect(deleteRes.success).toBe(true);

      // Thread should be gone
      const [threadCheck] = await db
        .select()
        .from(aiThreads)
        .where(eq(aiThreads.id, threadId));
      expect(threadCheck).toBeUndefined();

      // Messages should be cascade deleted
      const messagesCheck = await db
        .select()
        .from(aiMessages)
        .where(eq(aiMessages.threadId, threadId));
      expect(messagesCheck).toHaveLength(0);
    });

    it("should prevent User B from reading or deleting User A's thread", async () => {
      userA = await createTestUser();
      userB = await createTestUser();

      await loginAsTestUser(userA);
      const created = await createAiThreadAction("User A Secret Chat");
      const threadId = created.thread!.id;

      await loginAsTestUser(userB);
      const readRes = await getAiThreadMessagesAction(threadId);
      expect(readRes.error).toBe("Conversation not found.");

      const deleteRes = await deleteAiThreadAction(threadId);
      expect(deleteRes.error).toBe("Conversation not found.");

      // Ensure thread still exists
      const [threadCheck] = await db
        .select()
        .from(aiThreads)
        .where(eq(aiThreads.id, threadId));
      expect(threadCheck).toBeDefined();
    });
  });
});
