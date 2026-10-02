import { NextRequest, NextResponse } from "next/server";
import { dispatchNotifications } from "@/lib/notifications/dispatcher";

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    // If no CRON_SECRET is configured, block public access in production
    if (process.env.NODE_ENV === "production") return false;
    return true;
  }

  // 1. Check Authorization Bearer header
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7).trim();
    if (token === cronSecret) return true;
  }

  // 2. Check query parameter ?secret=...
  const secretParam = request.nextUrl.searchParams.get("secret");
  if (secretParam === cronSecret) return true;

  return false;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await dispatchNotifications();
    return NextResponse.json({ success: true, result });
  } catch (err: unknown) {
    console.error("[Cron Notifications] Error:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
