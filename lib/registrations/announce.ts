import "server-only";
import { after } from "next/server";
import { hasEnded } from "../editions/select";
import { sendConfirmationEmail } from "../email";
import { getStore } from ".";
import type { Registration } from "./types";

/**
 * Emails guests just given a spot from the waitlist their "you're in", once
 * the response has gone out. One at a time, to go easy on Gmail.
 */
export function announceSpots(promoted: Registration[]) {
  if (promoted.length === 0) return;
  after(async () => {
    const store = getStore();
    for (const { code, passToken, eventSlug } of promoted) {
      // Fresh each time: the date can be called off, or the guest drop out,
      // while earlier emails go out.
      const [edition, registration] = await Promise.all([
        store.getEdition(eventSlug),
        store.getByCode(code),
      ]);
      if (!edition || edition.status !== "published" || hasEnded(edition, new Date())) return;
      if (registration?.passToken !== passToken || registration.status !== "confirmed") continue;
      await sendConfirmationEmail(registration, edition);
    }
  });
}
