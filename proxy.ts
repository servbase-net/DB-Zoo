import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ACTIVE_SESSION_COOKIE } from "@/lib/session/constants";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isDashboard =
    pathname.startsWith("/connections") ||
    pathname.startsWith("/explorer") ||
    pathname.startsWith("/query") ||
    pathname.startsWith("/tables") ||
    pathname.startsWith("/relational-diagram") ||
    pathname.startsWith("/server-info");
  if (!isDashboard) return NextResponse.next();

  const session = request.cookies.get(ACTIVE_SESSION_COOKIE)?.value;
  if (!session) {
    const url = new URL("/login", request.url);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/connections/:path*",
    "/explorer/:path*",
    "/query/:path*",
    "/tables/:path*",
    "/relational-diagram/:path*",
    "/server-info/:path*",
  ],
};
