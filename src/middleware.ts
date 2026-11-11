import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const SESSION_COOKIE_NAME = "rp_session";

const PROTECTED_PREFIXES = ["/resume", "/profile", "/tailor", "/print"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  const isRoot = pathname === "/";
  const isProtected = isRoot || PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  // If visiting protected route without a session cookie, redirect to login
  if (isProtected && !token) {
    const loginUrl = new URL("/login", request.url);
    if (!isRoot) {
      loginUrl.searchParams.set("from", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // If already authenticated and visiting login or signup page, redirect to resume workspace
  if ((pathname === "/login" || pathname === "/signup") && token) {
    return NextResponse.redirect(new URL("/resume", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes (handled directly in route handlers)
     * - _next/static (static chunks and files)
     * - _next/image (image optimization files)
     * - static assets: favicon.ico, fonts
     */
    "/((?!api|_next/static|_next/image|favicon.ico|fonts).*)",
  ],
};
