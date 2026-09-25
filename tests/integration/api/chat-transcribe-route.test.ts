import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { POST } from "@/app/api/chat/transcribe/route";
import { cleanupTestUser } from "../setup/test-db";
import {
  createTestUser,
  loginAsTestUser,
  logoutTestUser,
  TestUserData,
} from "../setup/auth-helper";

describe("Integration: API Route /api/chat/transcribe", () => {
  let user: TestUserData;
  const originalEnvKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    vi.restoreAllMocks();
    logoutTestUser();
    process.env.OPENAI_API_KEY = "test-openai-key";
  });

  afterAll(async () => {
    process.env.OPENAI_API_KEY = originalEnvKey;
    if (user?.id) await cleanupTestUser(user.id);
  });

  it("should return 401 Unauthorized when session is absent", async () => {
    const formData = new FormData();
    formData.append(
      "file",
      new Blob(["dummy audio data"], { type: "audio/webm" }),
      "test.webm"
    );

    const req = new Request("http://localhost:3000/api/chat/transcribe", {
      method: "POST",
      body: formData,
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("should return 400 when OPENAI_API_KEY is missing", async () => {
    delete process.env.OPENAI_API_KEY;
    user = await createTestUser();
    await loginAsTestUser(user);

    const formData = new FormData();
    formData.append(
      "file",
      new Blob(["dummy audio data"], { type: "audio/webm" }),
      "test.webm"
    );

    const req = new Request("http://localhost:3000/api/chat/transcribe", {
      method: "POST",
      body: formData,
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("OpenAI API key is missing");
  });

  it("should return 400 when no audio file is provided", async () => {
    user = await createTestUser();
    await loginAsTestUser(user);

    const formData = new FormData();
    const req = new Request("http://localhost:3000/api/chat/transcribe", {
      method: "POST",
      body: formData,
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("No audio file provided.");
  });

  it("should successfully transcribe audio using gpt-transcribe model", async () => {
    user = await createTestUser();
    await loginAsTestUser(user);

    let capturedUrl = "";
    let capturedModel = "";
    let capturedAuth = "";

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation(async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = url.toString();
      capturedAuth = (init?.headers as Record<string, string>)?.Authorization || "";

      if (init?.body instanceof FormData) {
        capturedModel = init.body.get("model") as string;
      }

      return new Response(
        JSON.stringify({ text: "Schedule a team meeting tomorrow at 10am." }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });

    try {
      const formData = new FormData();
      formData.append(
        "file",
        new Blob(["fake audio stream"], { type: "audio/webm" }),
        "mic-input.webm"
      );

      const req = new Request("http://localhost:3000/api/chat/transcribe", {
        method: "POST",
        body: formData,
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.text).toBe("Schedule a team meeting tomorrow at 10am.");
      expect(capturedUrl).toBe("https://api.openai.com/v1/audio/transcriptions");
      expect(capturedAuth).toBe("Bearer test-openai-key");
      expect(capturedModel).toBe("gpt-transcribe");
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("should return error status and message when OpenAI API fails", async () => {
    user = await createTestUser();
    await loginAsTestUser(user);

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation(async () => {
      return new Response(
        JSON.stringify({
          error: { message: "Invalid audio format provided." },
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    });

    try {
      const formData = new FormData();
      formData.append(
        "file",
        new Blob(["corrupted audio"], { type: "audio/webm" }),
        "mic-input.webm"
      );

      const req = new Request("http://localhost:3000/api/chat/transcribe", {
        method: "POST",
        body: formData,
      });

      const res = await POST(req);
      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.error).toBe("Invalid audio format provided.");
    } finally {
      global.fetch = originalFetch;
    }
  });
});
