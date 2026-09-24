import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { GET } from "@/app/api/attachments/[id]/route";
import { NextRequest } from "next/server";
import { db, cleanupTestUser } from "../setup/test-db";
import {
  createTestUser,
  loginAsTestUser,
  logoutTestUser,
  TestUserData,
} from "../setup/auth-helper";
import { attachments } from "@/db/schema";
import { randomUUID } from "crypto";

describe("Integration: API Route /api/attachments/[id]", () => {
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

  it("should return 401 Unauthorized when session is absent", async () => {
    const req = new NextRequest("http://localhost:3000/api/attachments/123");
    const res = await GET(req, {
      params: Promise.resolve({ id: "123" }),
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized.");
  });

  it("should return 404 when attachment does not exist", async () => {
    userA = await createTestUser();
    await loginAsTestUser(userA);

    const nonExistentId = randomUUID();
    const req = new NextRequest(
      `http://localhost:3000/api/attachments/${nonExistentId}`
    );
    const res = await GET(req, {
      params: Promise.resolve({ id: nonExistentId }),
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Attachment not found.");
  });

  it("should return 404 when attachment belongs to another user (multi-tenant protection)", async () => {
    userA = await createTestUser();
    userB = await createTestUser();

    // Create attachment for User A
    const attId = randomUUID();
    await db.insert(attachments).values({
      id: attId,
      userId: userA.id,
      fileName: "secret-doc.pdf",
      filePath: `files/${attId}/secret-doc.pdf`,
      contentType: "application/pdf",
      fileSize: 1024,
    });

    // Request as User B
    await loginAsTestUser(userB);
    const req = new NextRequest(`http://localhost:3000/api/attachments/${attId}`);
    const res = await GET(req, {
      params: Promise.resolve({ id: attId }),
    });

    expect(res.status).toBe(404);
  });

  it("should redirect (307) with signed view URL when accessed by owner", async () => {
    userA = await createTestUser();
    await loginAsTestUser(userA);

    const attId = randomUUID();
    await db.insert(attachments).values({
      id: attId,
      userId: userA.id,
      fileName: "image.png",
      filePath: `files/${attId}/image.png`,
      thumbnailPath: `files/${attId}/thumb.webp`,
      contentType: "image/png",
      fileSize: 2048,
    });

    const req = new NextRequest(`http://localhost:3000/api/attachments/${attId}`);
    const res = await GET(req, {
      params: Promise.resolve({ id: attId }),
    });

    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toBeDefined();
    expect(location).toContain("signed-view.r2.test");
    expect(location).toContain(`files/${attId}/image.png`);
  });

  it("should redirect with thumbnail URL when ?thumb=1 is specified", async () => {
    userA = await createTestUser();
    await loginAsTestUser(userA);

    const attId = randomUUID();
    await db.insert(attachments).values({
      id: attId,
      userId: userA.id,
      fileName: "image.png",
      filePath: `files/${attId}/image.png`,
      thumbnailPath: `files/${attId}/thumb.webp`,
      contentType: "image/png",
      fileSize: 2048,
    });

    const req = new NextRequest(
      `http://localhost:3000/api/attachments/${attId}?thumb=1`
    );
    const res = await GET(req, {
      params: Promise.resolve({ id: attId }),
    });

    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toContain(`files/${attId}/thumb.webp`);
  });

  it("should stream inline PDF with strict sandbox and nosniff headers", async () => {
    userA = await createTestUser();
    await loginAsTestUser(userA);

    const attId = randomUUID();
    await db.insert(attachments).values({
      id: attId,
      userId: userA.id,
      fileName: "document.pdf",
      filePath: `files/${attId}/document.pdf`,
      contentType: "application/pdf",
      fileSize: 1024,
    });

    const req = new NextRequest(`http://localhost:3000/api/attachments/${attId}`);
    const res = await GET(req, {
      params: Promise.resolve({ id: attId }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-security-policy")).toBe("sandbox");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-disposition")).toBe('inline; filename="document.pdf"');

    const text = await res.text();
    expect(text).toContain("%PDF-1.4 sample stream");
  });

  it("should redirect to signed download URL for PDF when ?download=1 is specified", async () => {
    userA = await createTestUser();
    await loginAsTestUser(userA);

    const attId = randomUUID();
    await db.insert(attachments).values({
      id: attId,
      userId: userA.id,
      fileName: "document.pdf",
      filePath: `files/${attId}/document.pdf`,
      contentType: "application/pdf",
      fileSize: 1024,
    });

    const req = new NextRequest(
      `http://localhost:3000/api/attachments/${attId}?download=1`
    );
    const res = await GET(req, {
      params: Promise.resolve({ id: attId }),
    });

    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toContain("signed-download.r2.test");
    expect(location).toContain(`files/${attId}/document.pdf`);
  });
});
