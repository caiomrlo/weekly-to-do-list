import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = getSessionCookie(request);
  const isAuthenticated = Boolean(sessionCookie);

  const isLoginPage = pathname === "/login" || pathname === "/login/";
  const isInviteRoute = pathname.startsWith("/invite");

  if (!isAuthenticated && !isLoginPage && !isInviteRoute) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("redirect", pathname + request.nextUrl.search);
    }
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthenticated && isLoginPage) {
    const redirectParam = request.nextUrl.searchParams.get("redirect");
    const target =
      redirectParam &&
      redirectParam.startsWith("/") &&
      !redirectParam.startsWith("//")
        ? redirectParam
        : "/";
    const targetUrl = new URL(target, request.url);
    return NextResponse.redirect(targetUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
