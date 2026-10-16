import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { ADMIN_COOKIE, verifySessionToken } from "./admin-session";

export async function isAdmin(): Promise<boolean> {
  // Session expiry depends on the current time, so never prerender this.
  await connection();
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  return verifySessionToken(token, Date.now());
}

/** Call at the top of every admin page, route handler and server action. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/login");
}
