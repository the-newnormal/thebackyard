"use server";

import { refresh } from "next/cache";
import { hasEnded } from "@/lib/editions/select";
import { getStore } from "@/lib/registrations";
import { announceSpots } from "@/lib/registrations/announce";
import { isValidPassToken } from "@/lib/registrations/code";
import { helpSchema } from "@/lib/registrations/schema";

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

export type HelpState = {
  error?: string;
  /** What's saved now, after a submit. */
  saved?: { helpWith: string[] | null; helpNote: string | null };
};

/** Saves (or, with nothing ticked, withdraws) an offer to help, from the pass link. */
export async function offerHelp(
  passToken: string,
  _prev: HelpState,
  formData: FormData,
): Promise<HelpState> {
  if (!isValidPassToken(passToken)) return { error: "This pass link isn’t valid." };
  const parsed = helpSchema.safeParse({
    helpWith: formData.getAll("helpWith").map(String),
    helpNote: String(formData.get("helpNote") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { helpWith, helpNote } = parsed.data;
  let saved;
  try {
    saved = await getStore().setHelp(passToken, helpWith, helpNote);
  } catch (error) {
    console.error("Saving an offer to help failed", error);
    return { error: "We couldn’t save that just now. Please try again in a moment." };
  }
  if (!saved) return { error: "We couldn’t find this pass. Reload the page and try again." };
  refresh();
  return { saved: { helpWith: saved.helpWith, helpNote: saved.helpNote } };
}
