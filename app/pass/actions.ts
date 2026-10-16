"use server";

import { refresh } from "next/cache";
import { getStore } from "@/lib/registrations";
/** Lets a guest give up their spot from their pass link. */
export async function releaseSpot(passToken: string): Promise<void> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(passToken)) return;
  const store = getStore();
  const registration = await store.getByPassToken(passToken);
  if (!registration || registration.status === "cancelled") return;
  await store.update(normalized, { status: "cancelled", checkedInAt: null });
  refresh();
}
