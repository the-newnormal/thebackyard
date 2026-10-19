import type { Edition, EditionFields } from "./types";

// Pure functions of (editions, now): which edition the homepage, /register and
// /admin are about at a given moment.

export type EditionState =
  | "draft"
  | "cancelled"
  /** Published; registration hasn't opened yet. */
  | "upcoming"
  | "open"
  /** Registration closed; the event hasn't started. */
  | "closed"
  | "live"
  | "past";

const ms = (iso: string) => new Date(iso).getTime();
const byStart = (a: Edition, b: Edition) => ms(a.startsAt) - ms(b.startsAt);

export function isRegistrationOpen(edition: Edition, now: Date): boolean {
  const t = now.getTime();
  return (
    edition.status === "published" &&
    (!edition.registrationOpensAt || ms(edition.registrationOpensAt) <= t) &&
    t < ms(edition.registrationClosesAt)
  );
}

export const hasEnded = (edition: Edition, now: Date) => now.getTime() >= ms(edition.endsAt);

/** Until it starts, spots that open up go to the waitlist; then organisers decide. */
export const fillsFromWaitlist = (edition: Edition, now: Date) =>
  edition.status === "published" && now.getTime() < ms(edition.startsAt);

/** Edition changes that can open spots to the waitlist: the limit, status or start. */
export const opensSpots = (patch: Partial<EditionFields>) =>
  patch.capacity !== undefined || patch.status !== undefined || patch.startsAt !== undefined;

export function editionState(edition: Edition, now: Date): EditionState {
  if (edition.status === "draft") return "draft";
  if (edition.status === "cancelled") return "cancelled";
  const t = now.getTime();
  if (t >= ms(edition.endsAt)) return "past";
  if (t >= ms(edition.startsAt)) return "live";
  if (edition.registrationOpensAt && t < ms(edition.registrationOpensAt)) return "upcoming";
  return t < ms(edition.registrationClosesAt) ? "open" : "closed";
}

/**
 * The edition the homepage is about: the earliest published one that hasn't
 * ended. It only moves on at the end time, so on the night people still see
 * tonight's venue.
 */
export function featured(editions: Edition[], now: Date): Edition | null {
  return (
    editions
      .filter((e) => e.status === "published" && !hasEnded(e, now))
      .sort(byStart)[0] ?? null
  );
}

/** Editions taking sign-ups right now, soonest first. */
export function registrable(editions: Edition[], now: Date): Edition[] {
  return editions.filter((e) => isRegistrationOpen(e, now)).sort(byStart);
}

/** The next published edition whose registration opens later. */
export function nextOpening(editions: Edition[], now: Date): Edition | null {
  const t = now.getTime();
  return (
    editions
      .filter(
        (e) =>
          e.status === "published" &&
          e.registrationOpensAt !== null &&
          ms(e.registrationOpensAt) > t &&
          !hasEnded(e, now),
      )
      .sort((a, b) => ms(a.registrationOpensAt!) - ms(b.registrationOpensAt!))[0] ?? null
  );
}

/** A called-off edition that would otherwise be the next one up. */
export function calledOff(editions: Edition[], now: Date): Edition | null {
  const next = featured(editions, now);
  return (
    editions
      .filter(
        (e) =>
          e.status === "cancelled" &&
          !hasEnded(e, now) &&
          (!next || ms(e.startsAt) < ms(next.startsAt)),
      )
      .sort(byStart)[0] ?? null
  );
}

/**
 * The dashboard's default edition. It stays on an edition until 12 hours after
 * it ends, so the check-in desk doesn't jump to next month mid-event.
 */
export function adminFocus(editions: Edition[], now: Date): Edition | null {
  const cutoff = now.getTime() - 12 * 60 * 60 * 1000;
  const live = editions.filter((e) => e.status !== "draft");
  return (
    live.filter((e) => ms(e.endsAt) > cutoff).sort(byStart)[0] ??
    live.sort((a, b) => byStart(b, a))[0] ??
    editions.filter((e) => e.status === "draft").sort(byStart)[0] ??
    null
  );
}

/** Seconds until any public edition next changes state, or null if none will. */
export function nextBoundarySeconds(editions: Edition[], now: Date): number | null {
  const t = now.getTime();
  const upcoming = editions
    .filter((e) => e.status !== "draft")
    .flatMap((e) => [e.registrationOpensAt, e.registrationClosesAt, e.startsAt, e.endsAt])
    .filter((iso): iso is string => iso !== null)
    .map(ms)
    .filter((at) => at > t);
  return upcoming.length ? Math.ceil((Math.min(...upcoming) - t) / 1000) : null;
}
