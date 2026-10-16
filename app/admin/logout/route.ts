import { cookies } from "next/headers";
import { ADMIN_COOKIE } from "@/lib/admin-session";

// A plain form POST (not a server action), so the browser does a full page
// load and the dashboard, guest list included, is gone from memory.
export async function POST(request: Request) {
  (await cookies()).delete(ADMIN_COOKIE);
  return new Response(null, {
    status: 303,
    headers: { Location: new URL("/admin/login", request.url).toString() },
  });
}
