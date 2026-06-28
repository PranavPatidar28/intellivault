import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic auth redirects.
 *
 * This only reads the session cookie (no DB/network call) to decide redirects —
 * it is a UX/defense-in-depth layer, NOT the authorization boundary. Real
 * authorization is enforced server-side: every protected page is under the
 * (app) route group whose layout calls requireAuth(), and every API route
 * re-validates the session. A forged/expired cookie that slips past this check
 * is still rejected there.
 */
export default function authMiddleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAuthRoute =
    pathname.startsWith("/signin") || pathname.startsWith("/signup");
  const isAppRoute =
    pathname.startsWith("/dashboard") || pathname.startsWith("/notes");

  const hasSession = getSessionCookie(request) !== null;

  // Redirect unauthenticated users away from protected pages, preserving where
  // they were headed via a same-origin callbackUrl (just a path, never a full
  // URL, so it cannot be used as an open redirect).
  if (!hasSession && isAppRoute) {
    const signInUrl = new URL("/signin", request.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  // Redirect authenticated users away from auth pages.
  if (hasSession && isAuthRoute) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/notes/:path*", "/signin", "/signup"],
};
