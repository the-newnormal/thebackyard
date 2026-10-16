"use server";

import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import {
  ADMIN_COOKIE,
  checkPassword,
  createSessionToken,
  isAdminConfigured,
  MIN_PASSWORD_LENGTH,
  SESSION_TTL_SECONDS,
} from "@/lib/admin-session";
import { event } from "@/content/event";
import { sendConfirmationEmail } from "@/lib/email";
import {
  getCapacity,
  getStore,
  partySize,
  placement,
  type RegistrationStatus,
} from "@/lib/registrations";
import { isValidCode } from "@/lib/registrations/code";

export async function login(
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  if (!isAdminConfigured()) {
    return {
      error: `Admin is disabled. Set ADMIN_PASSWORD (at least ${MIN_PASSWORD_LENGTH} characters) to turn it on.`,
    };
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

function codeFrom(formData: FormData): string | null {
  const code = String(formData.get("code") ?? "");
  return isValidCode(code) ? code : null;
}

export async function setCheckedIn(formData: FormData) {
  await requireAdmin();
  const code = codeFrom(formData);
  if (!code) return;
  const checkedIn = formData.get("checkedIn") === "true";
  await getStore().setCheckedIn(code, checkedIn ? new Date().toISOString() : null);
  refresh();
}

const STATUSES: RegistrationStatus[] = ["confirmed", "waitlist", "cancelled"];

export async function setStatus(formData: FormData) {
  await requireAdmin();
  const code = codeFrom(formData);
  const status = String(formData.get("status")) as RegistrationStatus;
  if (!code || !STATUSES.includes(status)) return;
  const store = getStore();
  const before = await store.getByCode(code);
  if (!before || before.status === status) return;
  const updated = await store.update(code, {
    status,
    ...(status === "cancelled" ? { checkedInAt: null } : {}),
  });
  // Let a waitlisted guest know they've been given a spot.
  if (updated && before.status === "waitlist" && status === "confirmed") {
    after(() => sendConfirmationEmail(updated));
  }
  refresh();
}

/** Un-cancels a registration, placing it the way a new sign-up would be. */
export async function restoreRegistration(formData: FormData) {
  await requireAdmin();
  const code = codeFrom(formData);
  if (!code) return;
  const store = getStore();
  const registration = await store.getByCode(code);
  if (!registration || registration.status !== "cancelled") return;
  const { confirmed, waitlist } = await store.headcount(event.slug);
  const status = placement(
    partySize(registration),
    { confirmed, waiting: waitlist > 0 },
    getCapacity(),
  );
  await store.update(code, { status });
  refresh();
}

export async function deleteRegistration(formData: FormData) {
  await requireAdmin();
  const code = codeFrom(formData);
  if (!code) return;
  await getStore().remove(code);
  refresh();
}
