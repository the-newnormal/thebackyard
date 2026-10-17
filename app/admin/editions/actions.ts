"use server";

import { createHash } from "node:crypto";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { editionFormSchema } from "@/lib/editions/schema";
import { sgtParts } from "@/lib/editions/plan";
import { editionState, hasEnded, isRegistrationOpen } from "@/lib/editions/select";
import type { Edition, EditionFields, StoredPoster } from "@/lib/editions/types";
import { eventDateShort } from "@/lib/format";
import { getStore } from "@/lib/registrations";

// Every change here shows on the homepage straight away: the public schedule
// is cached under the "editions" tag.

export type EditionFormState = {
  message?: string;
  /** The version a failed save was posted against (see edition-form.tsx). */
  version?: string;
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
  const version = String(formData.get("version") ?? "") || undefined;
  const parsed = editionFormSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      (fieldErrors[String(issue.path[0] ?? "form")] ??= []).push(issue.message);
    }
    return { message: "A few things need fixing below.", fieldErrors, values, version };
  }

  const store = getStore();
  const slug = slugFrom(formData);
  const existing = slug ? await store.getEdition(slug) : null;
  if (slug && !existing) return { message: "That date no longer exists.", values, version };
  // A failed save keeps what was typed, but only for the version it was typed against.
  const fail = (message: string, field?: string, error?: string): EditionFormState => ({
    message,
    fieldErrors: field && error ? { [field]: [error] } : undefined,
    values,
    version,
  });
  // Saving a form loaded before, say, "Close sign-ups now" would quietly undo it.
  const stale = () =>
    fail(
      "This date changed after you opened this page (maybe sign-ups were closed or reopened). Reload the page to see the latest, then make your change again.",
    );
  // Two dates on one day would split the guest list in two.
  const taken = (other: Edition) =>
    fail(
      `There’s already a Backyard on ${eventDateShort(other)}. Edit that one instead, or pick another day.`,
      "date",
      "Already taken",
    );
  if (existing && version !== existing.updatedAt) return stale();
  const { startsAt, endsAt } = parsed.data;
  const now = new Date();

  if (!existing) {
    const publish = formData.get("intent") === "publish";
    // Publishing a date that's already passed would only confuse people.
    if (publish && new Date(startsAt) <= now) {
      return fail(
        "That date is in the past. Save it as a draft, or pick a later date.",
        "date",
        "In the past",
      );
    }
    const result = await store.createEdition({
      ...parsed.data,
      status: publish ? "published" : "draft",
      poster: null,
      calledOffNote: null,
    });
    if (result.kind === "date-taken") return taken(result.edition);
    updateTag("editions");
    redirect(`/admin/editions/${result.edition.slug}?saved=${publish ? "published" : "draft"}`);
  }

  if (existing.status !== "draft") {
    const movedDay = sgtParts(existing.startsAt).date !== sgtParts(startsAt).date;
    const retimed = existing.startsAt !== startsAt || existing.endsAt !== endsAt;
    // Its guest list (and check-ins) belong to the night it happened.
    if (movedDay && new Date(existing.startsAt) <= now) {
      return fail(
        "This date has already started, so it keeps its day and guest list. To plan another, use “Copy to next month” on the Dates page.",
        "date",
        "Already started",
      );
    }
    if (retimed && hasEnded(existing, now)) {
      return fail("This date is over, so its times stay as they were.", "endTime", "Already over");
    }
    // Ending it in the past would end it for everyone with a pass.
    if (retimed && new Date(endsAt) <= now) {
      return fail("That time is in the past. Pick a later one.", "endTime", "In the past");
    }
  }
  const result = await store.updateEdition(existing.slug, parsed.data, version);
  if (result.kind === "not-found") return fail("That date no longer exists.");
  if (result.kind === "changed") return stale();
  if (result.kind === "date-taken") return taken(result.edition);
  updateTag("editions");
  return {
    saved: true,
    message:
      existing.status === "draft"
        ? "Saved. It’s still a draft: publish it above when you’re ready."
        : "Saved. Passes and the homepage show the changes now.",
  };
}

/** Publish, unpublish, call off or un-cancel a date. */
export async function setEditionStatus(formData: FormData) {
  await requireAdmin();
  const store = getStore();
  const edition = await store.getEdition(slugFrom(formData));
  if (!edition) return;
  const to = String(formData.get("status"));
  const now = new Date();

  if (to === "draft" && edition.status === "published") {
    // Only while nobody has signed up (checked under the sign-up lock); once
    // people have passes, call it off instead so they find out.
    if (await store.unpublishEdition(edition.slug)) updateTag("editions");
    return;
  }

  let patch: Partial<EditionFields> | null = null;
  if (to === "published" && edition.status === "draft") {
    if (new Date(edition.startsAt) > now) patch = { status: "published" };
  } else if (to === "published" && edition.status === "cancelled") {
    if (!hasEnded(edition, now)) patch = { status: "published", calledOffNote: null };
  } else if (to === "cancelled" && edition.status === "published" && !hasEnded(edition, now)) {
    const note = String(formData.get("calledOffNote") ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 500);
    patch = { status: "cancelled", calledOffNote: note || null };
  }
  if (!patch) return;
  // Refused (unchanged) if it changed meanwhile or would share a day with another date.
  const result = await store.updateEdition(edition.slug, patch, edition.updatedAt);
  if (result.kind === "updated") updateTag("editions");
}

/**
 * "Close sign-ups now" while they're open, or "Reopen sign-ups" (until the
 * start) after they've closed. Neither applies once the event has started, or
 * before sign-ups have opened: change those times in the form instead.
 */
export async function setRegistrationWindow(formData: FormData) {
  await requireAdmin();
  const store = getStore();
  const edition = await store.getEdition(slugFrom(formData));
  if (!edition) return;
  const now = new Date();
  const mode = formData.get("mode");
  const closesAt =
    mode === "close" && isRegistrationOpen(edition, now)
      ? now.toISOString()
      : mode === "reopen" && editionState(edition, now) === "closed"
        ? edition.startsAt
        : null;
  if (!closesAt) return;
  const result = await store.updateEdition(
    edition.slug,
    { registrationClosesAt: closesAt },
    edition.updatedAt,
  );
  if (result.kind === "updated") updateTag("editions");
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
    // The removed image is deleted, unless another date shows it too.
    await store.sweepPosters();
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

  // Named by content, so a URL always shows the same image.
  const id = createHash("sha256").update(bytes).digest("hex").slice(0, 32);
  const poster = { id, contentType: kind.type, width, height, bytes };
  await store.putPoster(poster);
  const result = await store.updateEdition(edition.slug, {
    poster: { src: `/posters/${id}.${kind.ext}`, width, height },
  });
  if (result.kind !== "updated") {
    await store.sweepPosters();
    return { error: "That date no longer exists." };
  }
  // Again, in case a clean-up elsewhere removed the same image in between;
  // now that this date points at it, no clean-up will delete it.
  await store.putPoster(poster);
  // The replaced image is deleted, unless another date shows it too.
  await store.sweepPosters();
  updateTag("editions");
  return {};
}
