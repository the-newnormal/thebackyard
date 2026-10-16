"use server";

import { refresh } from "next/cache";
import { getStore } from "@/lib/registrations";
import { isValidPassToken } from "@/lib/registrations/code";

/** Lets a guest give up their spot from their pass link. */
export async function releaseSpot(passToken: string): Promise<void> {
  if (!isValidPassToken(passToken)) return;
  await getStore().releaseByPassToken(passToken);
  refresh();
}
