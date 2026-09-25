import { describe, it, expect, afterAll } from "vitest";
import { db, cleanupTestUser } from "../setup/test-db";
import { createTestUser, TestUserData } from "../setup/auth-helper";
import {
  users,
  workspaces,
  tasks,
  docs,
  projects,
  tags,
  attachments,
  taskDocs,
  aiThreads,
  aiMessages,
} from "@/db/schema";
import { eq } from "drizzle-orm";

describe("Integration: Database Schema Integrity & Cascades", () => {
  let testUser: TestUserData;

  afterAll(async () => {
    if (testUser?.id) {
      await cleanupTestUser(testUser.id);
    }
  });

  it("should cascade-delete all child entities when a user is deleted", async () => {
    testUser = await createTestUser();
    const userId = testUser.id;
    const workspaceId = testUser.preferences.activeWorkspaceId!;

    // Insert project, tag, task, doc, attachment
    const [proj] = await db
      .insert(projects)
      .values({ workspaceId, userId, name: "Cascade Project", color: "indigo" })
      .returning();

    const [tag] = await db
      .insert(tags)
      .values({ workspaceId, userId, name: "Cascade Tag", color: "rose" })
      .returning();

    const [task] = await db
      .insert(tasks)
      .values({
        workspaceId,
        userId,
        projectId: proj.id,
        tagId: tag.id,
        title: "Cascade Task",
      })
      .returning();

    const [doc] = await db
      .insert(docs)
      .values({
        workspaceId,
        userId,
        projectId: proj.id,
        title: "Cascade Doc",
      })
      .returning();

    const [att] = await db
      .insert(attachments)
      .values({
        userId,
        fileName: "file.pdf",
        filePath: "files/att/file.pdf",
        contentType: "application/pdf",
        fileSize: 1024,
      })
      .returning();

    // Insert taskDoc junction
    await db.insert(taskDocs).values({
      userId,
      taskId: task.id,
      docId: doc.id,
    });

    // Insert AI thread and message
    const [thread] = await db
      .insert(aiThreads)
      .values({
        workspaceId,
        userId,
        title: "Cascade AI Thread",
      })
      .returning();

    await db.insert(aiMessages).values({
      threadId: thread.id,
      role: "user",
      content: "Cascade AI Message",
    });

    // Delete user
    await db.delete(users).where(eq(users.id, userId));

    // Verify all cascading deletions
    const [taskCheck] = await db.select().from(tasks).where(eq(tasks.id, task.id));
    expect(taskCheck).toBeUndefined();

    const [docCheck] = await db.select().from(docs).where(eq(docs.id, doc.id));
    expect(docCheck).toBeUndefined();

    const [projCheck] = await db.select().from(projects).where(eq(projects.id, proj.id));
    expect(projCheck).toBeUndefined();

    const [tagCheck] = await db.select().from(tags).where(eq(tags.id, tag.id));
    expect(tagCheck).toBeUndefined();

    const [attCheck] = await db.select().from(attachments).where(eq(attachments.id, att.id));
    expect(attCheck).toBeUndefined();

    const [taskDocCheck] = await db
      .select()
      .from(taskDocs)
      .where(eq(taskDocs.taskId, task.id));
    expect(taskDocCheck).toBeUndefined();

    const [threadCheck] = await db
      .select()
      .from(aiThreads)
      .where(eq(aiThreads.id, thread.id));
    expect(threadCheck).toBeUndefined();

    const messagesCheck = await db
      .select()
      .from(aiMessages)
      .where(eq(aiMessages.threadId, thread.id));
    expect(messagesCheck).toHaveLength(0);
  });

  it("should set foreign keys to NULL when project or tag is deleted (onDelete: set null)", async () => {
    testUser = await createTestUser();
    const userId = testUser.id;
    const workspaceId = testUser.preferences.activeWorkspaceId!;

    const [proj] = await db
      .insert(projects)
      .values({ workspaceId, userId, name: "Nullify Project", color: "emerald" })
      .returning();

    const [tag] = await db
      .insert(tags)
      .values({ workspaceId, userId, name: "Nullify Tag", color: "sky" })
      .returning();

    const [task] = await db
      .insert(tasks)
      .values({
        workspaceId,
        userId,
        projectId: proj.id,
        tagId: tag.id,
        title: "Preserved Task",
      })
      .returning();

    const [doc] = await db
      .insert(docs)
      .values({
        workspaceId,
        userId,
        projectId: proj.id,
        title: "Preserved Doc",
      })
      .returning();

    // Delete project
    await db.delete(projects).where(eq(projects.id, proj.id));

    // Delete tag
    await db.delete(tags).where(eq(tags.id, tag.id));

    // Check task still exists, but projectId and tagId are null
    const [taskAfter] = await db.select().from(tasks).where(eq(tasks.id, task.id));
    expect(taskAfter).toBeDefined();
    expect(taskAfter.projectId).toBeNull();
    expect(taskAfter.tagId).toBeNull();

    // Check doc still exists, but projectId is null
    const [docAfter] = await db.select().from(docs).where(eq(docs.id, doc.id));
    expect(docAfter).toBeDefined();
    expect(docAfter.projectId).toBeNull();
  });

  it("should enforce unique constraints on task_docs junction", async () => {
    testUser = await createTestUser();
    const userId = testUser.id;
    const workspaceId = testUser.preferences.activeWorkspaceId!;

    const [task] = await db
      .insert(tasks)
      .values({ workspaceId, userId, title: "T1" })
      .returning();

    const [doc] = await db
      .insert(docs)
      .values({ workspaceId, userId, title: "D1" })
      .returning();

    // First insert succeeds
    await db.insert(taskDocs).values({
      userId,
      taskId: task.id,
      docId: doc.id,
    });

    // Duplicate insert should throw unique constraint error
    await expect(
      db.insert(taskDocs).values({
        userId,
        taskId: task.id,
        docId: doc.id,
      })
    ).rejects.toThrow();
  });

  it("should cascade-delete all entities when a workspace is deleted", async () => {
    testUser = await createTestUser();
    const userId = testUser.id;

    // Create a custom workspace
    const [ws] = await db
      .insert(workspaces)
      .values({
        name: "Test Workspace",
        ownerId: userId,
        isDefault: false,
      })
      .returning();

    const [proj] = await db
      .insert(projects)
      .values({ workspaceId: ws.id, userId, name: "WS Proj", color: "amber" })
      .returning();

    const [task] = await db
      .insert(tasks)
      .values({ workspaceId: ws.id, userId, title: "WS Task" })
      .returning();

    const [doc] = await db
      .insert(docs)
      .values({ workspaceId: ws.id, userId, title: "WS Doc" })
      .returning();

    // Delete workspace
    await db.delete(workspaces).where(eq(workspaces.id, ws.id));

    // Verify cascade deletion of entities in this workspace
    const [taskCheck] = await db.select().from(tasks).where(eq(tasks.id, task.id));
    expect(taskCheck).toBeUndefined();

    const [docCheck] = await db.select().from(docs).where(eq(docs.id, doc.id));
    expect(docCheck).toBeUndefined();

    const [projCheck] = await db.select().from(projects).where(eq(projects.id, proj.id));
    expect(projCheck).toBeUndefined();
  });
});
