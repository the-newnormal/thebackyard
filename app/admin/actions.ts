"use server";

import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import {
  ADMIN_COOKIE,
  adminConfigError,
  checkPassword,
  createSessionToken,
  SESSION_TTL_SECONDS,
} from "@/lib/admin-session";
import { hasEnded } from "@/lib/editions/select";
import type { Edition } from "@/lib/editions/types";
import { isEmailConfigured, sendReminderEmails } from "@/lib/email";
import { getStore } from "@/lib/registrations";
import { announceSpots } from "@/lib/registrations/announce";
import { isValidCode } from "@/lib/registrations/code";
import { contactKey } from "@/lib/registrations/opt-outs";

export async function login(
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const configError = adminConfigError();
  if (configError) return { error: `Admin is disabled. ${configError}` };
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

/** "Give a spot": lets a waitlisted guest in, out of turn if need be, while there's room. */
export async function giveSpot(formData: FormData) {
  await requireAdmin();
  const code = codeFrom(formData);
  if (!code) return;
  const store = getStore();
  const registration = await store.getByCode(code);
  if (!registration) return;
  const edition = await store.getEdition(registration.eventSlug);
  // Nobody should get "you're in" for a date that's over or called off.
  if (!edition || edition.status === "cancelled" || hasEnded(edition, new Date())) return;
  const result = await store.giveSpot(code);
  if (result.kind === "given") announceSpots([result.registration]);
  refresh();
}

/** Cancels a registration; the spot it frees goes to the waitlist. */
export async function cancelRegistration(formData: FormData) {
  await requireAdmin();
  const code = codeFrom(formData);
  if (!code) return;
  const withdrawal = await getStore().cancel(code);
  if (withdrawal) announceSpots(withdrawal.promoted);
  refresh();
}

/** Un-cancels a registration, placing it the way a new sign-up would be. */
export async function restoreRegistration(formData: FormData) {
  await requireAdmin();
  const code = codeFrom(formData);
  if (!code) return;
  await getStore().restore(code);
  refresh();
}

export async function deleteRegistration(formData: FormData) {
  await requireAdmin();
  const code = codeFrom(formData);
  if (!code) return;
  const withdrawal = await getStore().remove(code);
  if (withdrawal) announceSpots(withdrawal.promoted);
  refresh();
}

export type ReminderState = { sent?: number; failed?: string[]; error?: string };

/** Emails every confirmed guest a reminder with their code and pass, before the date starts. */
export async function sendReminders(
  _prev: ReminderState,
  formData: FormData,
): Promise<ReminderState> {
  await requireAdmin();
  const store = getStore();
  const editions = await store.listEditions();
  const edition = editions.find((e) => e.slug === formData.get("slug"));
  const now = new Date();
  if (!edition || edition.status !== "published" || now >= new Date(edition.startsAt)) {
    return { error: "Reminders only go out for a published date that hasn’t started." };
  }
  if (!isEmailConfigured()) return { error: "Email isn’t set up, so nothing was sent." };
  const guests = (await store.list(edition.slug)).filter((r) => r.status === "confirmed");
  const starts = (e: Edition) => new Date(e.startsAt).getTime();
  const first = !editions.some((e) => e.status === "published" && starts(e) < starts(edition));
  return sendReminderEmails(guests, edition, { first, now });
}

export type OptOutState = { error?: string; added?: string; value?: string };

/** Records an emailed "Marketing opt-out" (Terms, Part B clause 7). */
export async function addOptOut(_prev: OptOutState, formData: FormData): Promise<OptOutState> {
  await requireAdmin();
  const value = String(formData.get("contact") ?? "");
  const contact = contactKey(value);
  if (!contact) {
    return {
      error:
        "That isn’t an email address or a mobile number. Numbers outside Singapore need their country code, like +60.",
      value,
    };
  }
  await getStore().addOptOut(contact);
  refresh();
  return { added: contact };
}

/** Sends them updates again, once they've asked for that in writing. */
export async function removeOptOut(formData: FormData) {
  await requireAdmin();
  const contact = contactKey(String(formData.get("contact") ?? ""));
  if (!contact) return;
  await getStore().removeOptOut(contact);
  refresh();
}
