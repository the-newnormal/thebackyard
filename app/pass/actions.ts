"use server";

import { refresh } from "next/cache";
import { getStore } from "@/lib/registrations";
import { isValidCode, normalizeCode } from "@/lib/registrations/code";

/** Lets a guest give up their spot from their pass link. */
export async function releaseSpot(code: string): Promise<void> {
  const normalized = normalizeCode(code);
  if (!isValidCode(normalized)) return;
  const store = getStore();
  const registration = await store.getByCode(normalized);
  if (!registration || registration.status === "cancelled") return;
  await store.update(normalized, { status: "cancelled", checkedInAt: null });
  refresh();
}
