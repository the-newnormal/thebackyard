"use server";

import { refresh } from "next/cache";
import { hasEnded } from "@/lib/editions/select";
import { getStore } from "@/lib/registrations";
import { announceSpots } from "@/lib/registrations/announce";
import { isValidPassToken } from "@/lib/registrations/code";

/** Lets a guest give up their spot from their pass link, until the event ends. */
export async function releaseSpot(passToken: string): Promise<void> {
  if (!isValidPassToken(passToken)) return;
  const store = getStore();
  const registration = await store.getByPassToken(passToken);
  if (!registration) return;
  const edition = await store.getEdition(registration.eventSlug);
  // Afterwards (or once called off) the list is the record of who came.
  if (edition && (edition.status === "cancelled" || hasEnded(edition, new Date()))) return;
  const withdrawal = await store.releaseByPassToken(passToken);
  // The spot goes to whoever has waited longest.
  if (withdrawal) announceSpots(withdrawal.promoted);
  refresh();
}
