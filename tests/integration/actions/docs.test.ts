import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import {
  getUserDocsAction,
  getDocByIdAction,
  createDocAction,
  updateDocAction,
  deleteDocAction,
  toggleDocFavoriteAction,
  getTaskDocsAction,
  linkDocToTaskAction,
  unlinkDocFromTaskAction,
  createAndLinkDocAction,
} from "@/app/actions/docs";
import { createTaskAction } from "@/app/actions/tasks";
import { createProjectAction } from "@/app/actions/projects";
import { db, cleanupTestUser } from "../setup/test-db";
import {
  createTestUser,
  loginAsTestUser,
  logoutTestUser,
  TestUserData,
} from "../setup/auth-helper";
import { docs, taskDocs } from "@/db/schema";
import { eq, and } from "drizzle-orm";

describe("Integration: Docs Actions", () => {
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
    it("should reject all docs actions when not logged in", async () => {
      const getList = await getUserDocsAction();
      expect(getList.error).toBe("Not authenticated.");

      const getById = await getDocByIdAction("random-id");
      expect(getById.error).toBe("Not authenticated.");

      const create = await createDocAction({ title: "Note" });
      expect(create.error).toBe("Not authenticated.");

      const update = await updateDocAction("random-id", { title: "Note 2" });
      expect(update.error).toBe("Not authenticated.");

      const del = await deleteDocAction("random-id");
      expect(del.error).toBe("Not authenticated.");

      const fav = await toggleDocFavoriteAction("random-id", true);
      expect(fav.error).toBe("Not authenticated.");

      const link = await linkDocToTaskAction("task-id", "doc-id");
      expect(link.error).toBe("Not authenticated.");

      const unlink = await unlinkDocFromTaskAction("task-id", "doc-id");
      expect(unlink.error).toBe("Not authenticated.");

      const createLink = await createAndLinkDocAction("task-id", { title: "Note" });
      expect(createLink.error).toBe("Not authenticated.");
    });
  });

  describe("createDocAction & Defaults", () => {
    it("should create document with fallback title if omitted", async () => {
      userA = await createTestUser();
      await loginAsTestUser(userA);

      const res = await createDocAction({ title: "" });
      expect(res.error).toBeUndefined();
      expect(res.doc?.title).toBe("Untitled Document");
      expect(res.doc?.taskCount).toBe(0);

      const [saved] = await db.select().from(docs).where(eq(docs.id, res.doc!.id));
      expect(saved.userId).toBe(userA.id);
    });

    it("should associate document with project when specified", async () => {
      userA = await createTestUser();
      await loginAsTestUser(userA);

      const projRes = await createProjectAction({ name: "Specs", color: "indigo" });
      const docRes = await createDocAction({
        title: "Architecture Guide",
        content: "Markdown notes...",
        projectId: projRes.project!.id,
        isFavorite: true,
      });

      expect(docRes.error).toBeUndefined();
      expect(docRes.doc?.title).toBe("Architecture Guide");
      expect(docRes.doc?.project?.name).toBe("Specs");
      expect(docRes.doc?.isFavorite).toBe(true);
    });
  });

  describe("getUserDocsAction & Filters", () => {
    it("should filter docs by project, favorite, and search query", async () => {
      userA = await createTestUser();
      await loginAsTestUser(userA);

      const proj = await createProjectAction({ name: "Work" });
      const projId = proj.project!.id;

      await createDocAction({ title: "Meeting Notes", projectId: projId, isFavorite: true });
      await createDocAction({ title: "Sprint Goals", projectId: projId, isFavorite: false });
      await createDocAction({ title: "Personal Journal", isFavorite: true });

      // Filter by projectId
      const projFilter = await getUserDocsAction({ projectId: projId });
      expect(projFilter.docs?.length).toBe(2);

      // Filter by isFavorite
      const favFilter = await getUserDocsAction({ isFavorite: true });
      expect(favFilter.docs?.length).toBe(2);
      expect(favFilter.docs?.map((d) => d.title)).toContain("Meeting Notes");
      expect(favFilter.docs?.map((d) => d.title)).toContain("Personal Journal");

      // Search by keyword
      const searchRes = await getUserDocsAction({ search: "journal" });
      expect(searchRes.docs?.length).toBe(1);
      expect(searchRes.docs?.[0].title).toBe("Personal Journal");
    });

    it("should isolate documents between different users", async () => {
      userA = await createTestUser();
      userB = await createTestUser();

      await loginAsTestUser(userA);
      await createDocAction({ title: "User A Secret Notes" });

      await loginAsTestUser(userB);
      await createDocAction({ title: "User B Diary" });

      const resB = await getUserDocsAction();
      expect(resB.docs?.length).toBe(1);
      expect(resB.docs?.[0].title).toBe("User B Diary");

      await loginAsTestUser(userA);
      const resA = await getUserDocsAction();
      expect(resA.docs?.length).toBe(1);
      expect(resA.docs?.[0].title).toBe("User A Secret Notes");
    });
  });

  describe("updateDocAction, toggleDocFavoriteAction & deleteDocAction", () => {
    it("should update content, toggle favorite and delete document", async () => {
      userA = await createTestUser();
      await loginAsTestUser(userA);

      const created = await createDocAction({ title: "Draft Doc", content: "V1" });
      const docId = created.doc!.id;

      // Update
      const updated = await updateDocAction(docId, {
        title: "Published Doc",
        content: "V2 final",
      });
      expect(updated.error).toBeUndefined();
      expect(updated.doc?.title).toBe("Published Doc");
      expect(updated.doc?.content).toBe("V2 final");

      // Favorite toggle
      const favRes = await toggleDocFavoriteAction(docId, true);
      expect(favRes.success).toBe(true);

      const [favDoc] = await db.select().from(docs).where(eq(docs.id, docId));
      expect(favDoc.isFavorite).toBe(true);

      // Delete
      const delRes = await deleteDocAction(docId);
      expect(delRes.success).toBe(true);

      const [afterDel] = await db.select().from(docs).where(eq(docs.id, docId));
      expect(afterDel).toBeUndefined();
    });

    it("should prevent updating or deleting another user's document", async () => {
      userA = await createTestUser();
      userB = await createTestUser();

      await loginAsTestUser(userA);
      const doc = await createDocAction({ title: "A Doc" });
      const docId = doc.doc!.id;

      // Try update as User B
      await loginAsTestUser(userB);
      const updateRes = await updateDocAction(docId, { title: "Hijacked" });
      expect(updateRes.error).toBe("Document not found or access denied.");

      // Check DB remains untouched
      const [unchanged] = await db.select().from(docs).where(eq(docs.id, docId));
      expect(unchanged.title).toBe("A Doc");
    });
  });

  describe("Task-Doc Linking Actions", () => {
    it("should link doc to task, retrieve linked docs and unlink cleanly", async () => {
      userA = await createTestUser();
      await loginAsTestUser(userA);

      const taskRes = await createTaskAction({ title: "Task with Documentation" });
      const taskId = taskRes.task!.id;

      const docRes = await createDocAction({ title: "System Architecture" });
      const docId = docRes.doc!.id;

      // Link doc to task
      const linkRes = await linkDocToTaskAction(taskId, docId);
      expect(linkRes.success).toBe(true);

      // Verify task docs list
      const taskDocsRes = await getTaskDocsAction(taskId);
      expect(taskDocsRes.error).toBeUndefined();
      expect(taskDocsRes.docs?.length).toBe(1);
      expect(taskDocsRes.docs?.[0].title).toBe("System Architecture");

      // Verify getDocById includes linked task
      const docDetail = await getDocByIdAction(docId);
      expect(docDetail.doc?.taskCount).toBe(1);
      expect(docDetail.doc?.tasks?.[0].title).toBe("Task with Documentation");

      // Unlink doc from task
      const unlinkRes = await unlinkDocFromTaskAction(taskId, docId);
      expect(unlinkRes.success).toBe(true);

      const [junctionRow] = await db
        .select()
        .from(taskDocs)
        .where(and(eq(taskDocs.taskId, taskId), eq(taskDocs.docId, docId)));
      expect(junctionRow).toBeUndefined();

      // Document and Task still exist
      const [stillTask] = await db.select().from(docs).where(eq(docs.id, docId));
      expect(stillTask).toBeDefined();
    });

    it("should create and link a document in one step via createAndLinkDocAction", async () => {
      userA = await createTestUser();
      await loginAsTestUser(userA);

      const taskRes = await createTaskAction({ title: "Feature Task" });
      const taskId = taskRes.task!.id;

      const res = await createAndLinkDocAction(taskId, {
        title: "Instant Linked Spec",
      });

      expect(res.error).toBeUndefined();
      expect(res.doc?.title).toBe("Instant Linked Spec");
      expect(res.doc?.taskCount).toBe(1);

      // Verify DB junction
      const [junction] = await db
        .select()
        .from(taskDocs)
        .where(
          and(eq(taskDocs.taskId, taskId), eq(taskDocs.docId, res.doc!.id))
        );
      expect(junction).toBeDefined();
    });
  });
});
