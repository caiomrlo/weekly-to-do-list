import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import {
  uploadAttachmentAction,
  getTaskAttachmentsAction,
  getDocAttachmentsAction,
  deleteAttachmentAction,
} from "@/app/actions/attachments";
import { createTaskAction } from "@/app/actions/tasks";
import { createDocAction } from "@/app/actions/docs";
import { db, cleanupTestUser } from "../setup/test-db";
import {
  createTestUser,
  loginAsTestUser,
  logoutTestUser,
  TestUserData,
} from "../setup/auth-helper";
import { attachments, taskAttachments, docAttachments } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { uploadToR2, deleteFromR2 } from "@/lib/r2";

const VALID_1X1_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

describe("Integration: Attachments Actions", () => {
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
    it("should reject operations when not authenticated", async () => {
      const formData = new FormData();
      const uploadRes = await uploadAttachmentAction(formData);
      expect(uploadRes.error).toBe("Not authenticated.");

      const taskAtt = await getTaskAttachmentsAction("task-id");
      expect(taskAtt.error).toBe("Not authenticated.");

      const docAtt = await getDocAttachmentsAction("doc-id");
      expect(docAtt.error).toBe("Not authenticated.");

      const del = await deleteAttachmentAction("att-id");
      expect(del.error).toBe("Not authenticated.");
    });
  });

  describe("uploadAttachmentAction Validations", () => {
    it("should reject upload without taskId or docId", async () => {
      userA = await createTestUser();
      await loginAsTestUser(userA);

      const file = new File([Buffer.from("test")], "doc.pdf", {
        type: "application/pdf",
      });
      const fd = new FormData();
      fd.set("file", file);

      const res = await uploadAttachmentAction(fd);
      expect(res.error).toBe("Invalid target: taskId or docId is required.");
    });

    it("should reject unsupported MIME types", async () => {
      userA = await createTestUser();
      await loginAsTestUser(userA);

      const task = await createTaskAction({ title: "Task for upload" });
      const taskId = task.task!.id;

      const file = new File([Buffer.from("hello world")], "test.txt", {
        type: "text/plain",
      });
      const fd = new FormData();
      fd.set("taskId", taskId);
      fd.set("file", file);

      const res = await uploadAttachmentAction(fd);
      expect(res.error).toContain("Unsupported format.");
    });

    it("should reject spoofed image uploads where client MIME is image/png but bytes are plain text", async () => {
      userA = await createTestUser();
      await loginAsTestUser(userA);

      const task = await createTaskAction({ title: "Task for spoof upload" });
      const taskId = task.task!.id;

      // Spoofed file: Advertises image/png but body is plain text
      const spoofedFile = new File([Buffer.from("not a real png")], "exploit.png", {
        type: "image/png",
      });
      const fd = new FormData();
      fd.set("taskId", taskId);
      fd.set("file", spoofedFile);

      const res = await uploadAttachmentAction(fd);
      expect(res.error).toContain("Unsupported format.");
    });

    it("should reject spoofed PDF uploads where client MIME is application/pdf but bytes are HTML/JS", async () => {
      userA = await createTestUser();
      await loginAsTestUser(userA);

      const task = await createTaskAction({ title: "Task for script upload" });
      const taskId = task.task!.id;

      // Spoofed file: Advertises application/pdf but body is HTML
      const spoofedFile = new File(
        [Buffer.from("<script>alert('xss')</script>")],
        "malicious.pdf",
        { type: "application/pdf" }
      );
      const fd = new FormData();
      fd.set("taskId", taskId);
      fd.set("file", spoofedFile);

      const res = await uploadAttachmentAction(fd);
      expect(res.error).toContain("Unsupported format.");
    });

    it("should reject upload if target task belongs to another user", async () => {
      userA = await createTestUser();
      userB = await createTestUser();

      // Create task as User A
      await loginAsTestUser(userA);
      const task = await createTaskAction({ title: "User A Task" });
      const taskId = task.task!.id;

      // User B tries to upload to User A's task
      await loginAsTestUser(userB);
      const file = new File([VALID_1X1_PNG], "image.png", { type: "image/png" });
      const fd = new FormData();
      fd.set("taskId", taskId);
      fd.set("file", file);

      const res = await uploadAttachmentAction(fd);
      expect(res.error).toBe("Task not found or access denied.");
    });

    it("should reject file exceeding 10MB limit", async () => {
      userA = await createTestUser();
      await loginAsTestUser(userA);

      const task = await createTaskAction({ title: "User Task" });
      const taskId = task.task!.id;

      const oversizedFile = new File([Buffer.from("dummy content")], "large.png", {
        type: "image/png",
      });
      Object.defineProperty(oversizedFile, "size", {
        value: 10 * 1024 * 1024 + 1,
      });

      const fd = new FormData();
      fd.set("taskId", taskId);
      fd.set("file", oversizedFile);

      const res = await uploadAttachmentAction(fd);
      expect(res.error).toBe("The file exceeds the maximum allowed limit of 10MB.");
    });
  });

  describe("Successful Uploads and Retrieval", () => {
    it("should upload image to task, save in DB, mock R2, and fetch via getTaskAttachmentsAction", async () => {
      userA = await createTestUser();
      await loginAsTestUser(userA);

      const task = await createTaskAction({ title: "Task with Image" });
      const taskId = task.task!.id;

      const file = new File([VALID_1X1_PNG], "photo.png", { type: "image/png" });
      const fd = new FormData();
      fd.set("taskId", taskId);
      fd.set("file", file);

      const res = await uploadAttachmentAction(fd);
      expect(res.error).toBeUndefined();
      expect(res.attachment).toBeDefined();
      expect(res.attachment?.fileName).toBe("photo.png");
      expect(res.attachment?.contentType).toBe("image/png");
      expect(uploadToR2).toHaveBeenCalled();

      // Verify in DB
      const attId = res.attachment!.id;
      const [saved] = await db.select().from(attachments).where(eq(attachments.id, attId));
      expect(saved).toBeDefined();
      expect(saved.userId).toBe(userA.id);

      // Verify task junction
      const [junction] = await db
        .select()
        .from(taskAttachments)
        .where(
          and(
            eq(taskAttachments.taskId, taskId),
            eq(taskAttachments.attachmentId, attId)
          )
        );
      expect(junction).toBeDefined();

      // Fetch task attachments
      const fetched = await getTaskAttachmentsAction(taskId);
      expect(fetched.attachments?.length).toBe(1);
      expect(fetched.attachments?.[0].id).toBe(attId);
    });

    it("should upload PDF to doc, save in DB, and fetch via getDocAttachmentsAction", async () => {
      userA = await createTestUser();
      await loginAsTestUser(userA);

      const doc = await createDocAction({ title: "Documentation" });
      const docId = doc.doc!.id;

      const file = new File([Buffer.from("%PDF-1.4 test")], "manual.pdf", {
        type: "application/pdf",
      });
      const fd = new FormData();
      fd.set("docId", docId);
      fd.set("file", file);

      const res = await uploadAttachmentAction(fd);
      expect(res.error).toBeUndefined();
      expect(res.attachment?.fileName).toBe("manual.pdf");

      const attId = res.attachment!.id;
      const [docJunction] = await db
        .select()
        .from(docAttachments)
        .where(
          and(
            eq(docAttachments.docId, docId),
            eq(docAttachments.attachmentId, attId)
          )
        );
      expect(docJunction).toBeDefined();

      const docAtts = await getDocAttachmentsAction(docId);
      expect(docAtts.attachments?.length).toBe(1);
      expect(docAtts.attachments?.[0].fileName).toBe("manual.pdf");
    });
  });

  describe("deleteAttachmentAction & unlinkAttachmentFromDocAction", () => {
    it("should delete attachment from DB, invoke deleteFromR2 and enforce isolation", async () => {
      userA = await createTestUser();
      userB = await createTestUser();

      await loginAsTestUser(userA);
      const doc = await createDocAction({ title: "My Notes" });
      const file = new File([Buffer.from("%PDF-1.4")], "sheet.pdf", {
        type: "application/pdf",
      });
      const fd = new FormData();
      fd.set("docId", doc.doc!.id);
      fd.set("file", file);
      const uploadRes = await uploadAttachmentAction(fd);
      const attId = uploadRes.attachment!.id;

      // User B tries to delete User A's attachment
      await loginAsTestUser(userB);
      const unauthorizedDel = await deleteAttachmentAction(attId);
      expect(unauthorizedDel.error).toBe("Attachment not found or access denied.");

      // User A deletes own attachment
      await loginAsTestUser(userA);
      const authorizedDel = await deleteAttachmentAction(attId);
      expect(authorizedDel.success).toBe(true);
      expect(deleteFromR2).toHaveBeenCalled();

      const [deletedCheck] = await db
        .select()
        .from(attachments)
        .where(eq(attachments.id, attId));
      expect(deletedCheck).toBeUndefined();
    });
  });
});
