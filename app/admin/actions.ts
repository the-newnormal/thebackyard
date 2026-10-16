"use server";

import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import {
  ADMIN_COOKIE,
  checkPassword,
  createSessionToken,
  isAdminConfigured,
  SESSION_TTL_SECONDS,
} from "@/lib/admin-session";
import { getStore, type RegistrationStatus } from "@/lib/registrations";
import { isValidCode } from "@/lib/registrations/code";

export async function login(
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  if (!isAdminConfigured()) {
    return { error: "Admin is disabled. Set ADMIN_PASSWORD to turn it on." };
  }
  if (!checkPassword(String(formData.get("password") ?? ""))) {
    // Slow down guessing.
    await new Promise((resolve) => setTimeout(resolve, 800));
    return { error: "That password isn’t right." };
  }
  (await cookies()).set(ADMIN_COOKIE, createSessionToken(Date.now()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  redirect("/admin");
}

export async function logout() {
  (await cookies()).delete(ADMIN_COOKIE);
  redirect("/admin/login");
}

function codeFrom(formData: FormData): string | null {
  const code = String(formData.get("code") ?? "");
  return isValidCode(code) ? code : null;
}

export async function setCheckedIn(formData: FormData) {
  await requireAdmin();
  const code = codeFrom(formData);
  if (!code) return;
  const checkedIn = formData.get("checkedIn") === "true";
  await getStore().update(code, {
    checkedInAt: checkedIn ? new Date().toISOString() : null,
    // Checking in a waitlisted guest means they got a spot after all.
    ...(checkedIn ? { status: "confirmed" as const } : {}),
  });
  refresh();
}

const STATUSES: RegistrationStatus[] = ["confirmed", "waitlist", "cancelled"];

export async function setStatus(formData: FormData) {
  await requireAdmin();
  const code = codeFrom(formData);
  const status = String(formData.get("status")) as RegistrationStatus;
  if (!code || !STATUSES.includes(status)) return;
  await getStore().update(code, {
    status,
    ...(status === "cancelled" ? { checkedInAt: null } : {}),
  });
  refresh();
}

export async function deleteRegistration(formData: FormData) {
  await requireAdmin();
  const code = codeFrom(formData);
  if (!code) return;
  await getStore().remove(code);
  refresh();
}
