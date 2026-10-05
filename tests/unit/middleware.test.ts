import { describe, it, expect } from "vitest";
import { middleware } from "@/middleware";
import { NextRequest } from "next/server";

describe("Unit: Middleware Route Protection", () => {
  it("should allow /api/cron/notifications without authentication", async () => {
    const req = new NextRequest("http://localhost:3000/api/cron/notifications?secret=my-secret");
    const res = await middleware(req);
    // NextResponse.next() returns a 200 response with x-middleware-next header
    expect(res.headers.get("x-middleware-next")).toBe("1");
    expect(res.status).toBe(200);
  });

  it("should allow /api/avatar/[id] without authentication", async () => {
    const req = new NextRequest("http://localhost:3000/api/avatar/some-id.webp");
    const res = await middleware(req);
    expect(res.headers.get("x-middleware-next")).toBe("1");
    expect(res.status).toBe(200);
  });

  it("should allow /sw.js without authentication", async () => {
    const req = new NextRequest("http://localhost:3000/sw.js");
    const res = await middleware(req);
    expect(res.headers.get("x-middleware-next")).toBe("1");
    expect(res.status).toBe(200);
  });

  it("should allow /login without authentication", async () => {
    const req = new NextRequest("http://localhost:3000/login");
    const res = await middleware(req);
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("should allow /invite/token without authentication", async () => {
    const req = new NextRequest("http://localhost:3000/invite/abc-123");
    const res = await middleware(req);
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("should redirect unauthenticated users on protected routes to /login with 307", async () => {
    const req = new NextRequest("http://localhost:3000/kanban");
    const res = await middleware(req);
    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toContain("/login?redirect=%2Fkanban");
  });
});
