import "server-only";
import { after } from "next/server";
import { hasEnded } from "../editions/select";
import { sendConfirmationEmail } from "../email";
import { getStore } from ".";
import type { Registration } from "./types";

/**
 * Emails guests just given a spot from one date's waitlist their "you're in",
 * once the response has gone out. One at a time, to go easy on Gmail.
 */
export function announceSpots(promoted: Registration[]) {
  if (promoted.length === 0) return;
  after(async () => {
    const edition = await getStore().getEdition(promoted[0].eventSlug);
    // Calling a date off doesn't wait for a fill already under way.
    if (!edition || edition.status !== "published" || hasEnded(edition, new Date())) return;
    for (const registration of promoted) await sendConfirmationEmail(registration, edition);
  });
}
