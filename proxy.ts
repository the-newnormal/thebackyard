import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/admin-session";

// Optimistic redirect for signed-out visitors. Pages, route handlers and
// server actions still check the session themselves. Only page loads are
// redirected: a redirected server action POST breaks the client router.
export function proxy(request: NextRequest) {
  if (request.method !== "GET" || request.headers.has("next-action")) {
    return NextResponse.next();
  }
  const token = request.cookies.get(ADMIN_COOKIE)?.value;
  if (verifySessionToken(token, Date.now())) return NextResponse.next();
  return NextResponse.redirect(new URL("/admin/login", request.url));
}

export const config = {
  matcher: ["/admin", "/admin/((?!login).*)"],
};
