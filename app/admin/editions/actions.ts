"use server";

import { createHash } from "node:crypto";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { editionFormSchema } from "@/lib/editions/schema";
import { hasEnded } from "@/lib/editions/select";
import type { EditionFields, StoredPoster } from "@/lib/editions/types";
import { getStore } from "@/lib/registrations";

// Every change here shows on the homepage straight away: the public schedule
// is cached under the "editions" tag.

export type EditionFormState = {
  message?: string;
  saved?: boolean;
  fieldErrors?: Partial<Record<string, string[]>>;
  values?: Record<string, string>;
};

const FIELDS = [
  "date",
  "startTime",
  "endTime",
  "opensAt",
  "closesAt",
  "capacity",
  "maxGuests",
  "venueName",
  "venueLevel",
  "venueAddress",
  "venueDirections",
  "venueMapsUrl",
  "notice",
];

const slugFrom = (formData: FormData) => String(formData.get("slug") ?? "");

/** Creates a date (as a draft or published) or saves changes to one. */
export async function saveEdition(
  _prev: EditionFormState,
  formData: FormData,
): Promise<EditionFormState> {
  await requireAdmin();
  const values = Object.fromEntries(FIELDS.map((key) => [key, String(formData.get(key) ?? "")]));
  const parsed = editionFormSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      (fieldErrors[String(issue.path[0] ?? "form")] ??= []).push(issue.message);
    }
    return { message: "A few things need fixing below.", fieldErrors, values };
  }

  const store = getStore();
  const slug = slugFrom(formData);
  if (slug) {
    const updated = await store.updateEdition(slug, parsed.data);
    if (!updated) return { message: "That date no longer exists.", values };
    updateTag("editions");
    return { saved: true, message: "Saved. Passes and the homepage show the changes now." };
  }

  const publish = formData.get("intent") === "publish";
  if (publish && new Date(parsed.data.startsAt) <= new Date()) {
    return {
      message: "That date is in the past. Save it as a draft, or pick a later date.",
      fieldErrors: { date: ["In the past"] },
      values,
    };
  }
  const created = await store.createEdition({
    ...parsed.data,
    status: publish ? "published" : "draft",
    poster: null,
  });
  updateTag("editions");
  redirect(`/admin/editions/${created.slug}?saved=${publish ? "published" : "draft"}`);
}

/** Publish, unpublish, call off or un-cancel a date. */
export async function setEditionStatus(formData: FormData) {
  await requireAdmin();
  const store = getStore();
  const edition = await store.getEdition(slugFrom(formData));
  if (!edition) return;
  const to = String(formData.get("status"));
  const now = new Date();

  let patch: Partial<EditionFields> | null = null;
  if (to === "published" && edition.status === "draft") {
    // Publishing a date that's already passed would only confuse people.
    if (new Date(edition.startsAt) > now) patch = { status: "published" };
  } else if (to === "published" && edition.status === "cancelled") {
    // The note was about calling it off.
    patch = { status: "published", notice: null };
  } else if (to === "draft" && edition.status === "published") {
    // Once people have passes, call it off instead, so they find out.
    const stats = (await store.editionStats())[edition.slug];
    if (!stats?.registrations) patch = { status: "draft" };
  } else if (to === "cancelled" && edition.status === "published" && !hasEnded(edition, now)) {
    const notice = String(formData.get("notice") ?? "").trim().slice(0, 500);
    patch = { status: "cancelled", notice: notice || edition.notice };
  }
  if (!patch) return;
  await store.updateEdition(edition.slug, patch);
  updateTag("editions");
}

/** "Close sign-ups now", or reopen them until the start (or the end, once it's started). */
export async function setRegistrationWindow(formData: FormData) {
  await requireAdmin();
  const store = getStore();
  const edition = await store.getEdition(slugFrom(formData));
  const now = new Date();
  if (!edition || edition.status !== "published" || hasEnded(edition, now)) return;

  const closes =
    formData.get("mode") === "close"
      ? now
      : new Date(new Date(edition.startsAt) > now ? edition.startsAt : edition.endsAt);
  const opens = edition.registrationOpensAt && new Date(edition.registrationOpensAt);
  await store.updateEdition(edition.slug, {
    registrationClosesAt: closes.toISOString(),
    // Opening must come before closing; an opening still ahead no longer applies.
    ...(opens && opens >= closes ? { registrationOpensAt: null } : {}),
  });
  updateTag("editions");
}

/** Only drafts nobody has signed up for. */
export async function deleteEdition(formData: FormData) {
  await requireAdmin();
  const result = await getStore().deleteEdition(slugFrom(formData));
  if (result !== "deleted") return;
  updateTag("editions");
  redirect("/admin/editions");
}

const MAX_POSTER_BYTES = 950_000; // Server actions accept 1MB, form fields included.

function sniff(bytes: Uint8Array): { type: StoredPoster["contentType"]; ext: string } | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { type: "image/jpeg", ext: "jpg" };
  if (ascii(1, 4) === "PNG" && bytes[0] === 0x89) return { type: "image/png", ext: "png" };
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return { type: "image/webp", ext: "webp" };
  return null;
}

/**
 * Saves a poster the browser has already shrunk (see poster-upload.tsx), or
 * removes it with intent=remove. Returns an error message, if any.
 */
export async function uploadPoster(formData: FormData): Promise<{ error?: string }> {
  await requireAdmin();
  const store = getStore();
  const edition = await store.getEdition(slugFrom(formData));
  if (!edition) return { error: "That date no longer exists." };

  if (formData.get("intent") === "remove") {
    await store.updateEdition(edition.slug, { poster: null });
    updateTag("editions");
    return {};
  }

  const file = formData.get("poster");
  if (!(file instanceof Blob) || file.size === 0) return { error: "Choose an image first." };
  if (file.size > MAX_POSTER_BYTES) return { error: "That image is too big. Try a smaller one." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniff(bytes);
  if (!kind) return { error: "Use a JPG, PNG or WebP image." };
  const [width, height] = ["width", "height"].map((key) => Number(formData.get(key)));
  if (![width, height].every((n) => Number.isInteger(n) && n >= 100 && n <= 6000)) {
    return { error: "That image is too small to use as a poster." };
  }

  // Named by content, so the URL can be cached forever.
  const id = createHash("sha256").update(bytes).digest("hex").slice(0, 32);
  await store.putPoster({ id, contentType: kind.type, width, height, bytes });
  await store.updateEdition(edition.slug, {
    poster: { src: `/posters/${id}.${kind.ext}`, width, height },
  });
  updateTag("editions");
  return {};
}
