import type {
  CreateEditionResult,
  DeleteEditionResult,
  UpdateEditionResult,
  Edition,
  EditionFields,
  EditionStats,
  StoredPoster,
} from "../editions/types";

export const DIETARY_OPTIONS = [
  { value: "none", label: "No restrictions" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "halal", label: "Halal" },
  { value: "no-beef", label: "No beef" },
  { value: "other", label: "Other" },
] as const;

/** Asked on the old one-page form; kept to label earlier sign-ups. */
export const HEARD_FROM_OPTIONS = [
  { value: "instagram", label: "Instagram" },
  { value: "friend", label: "A friend" },
  { value: "chat", label: "Telegram / WhatsApp" },
  { value: "walk-by", label: "Walked past" },
  { value: "other", label: "Somewhere else" },
] as const;

export type Dietary = (typeof DIETARY_OPTIONS)[number]["value"];
export type HeardFrom = (typeof HEARD_FROM_OPTIONS)[number]["value"];

export type RegistrationStatus = "confirmed" | "waitlist" | "cancelled";

export interface Registration {
  /** Short, human-readable code shown on the pass for check-in. */
  code: string;
  /** Unguessable secret in the pass URL; it alone can view or release the spot. */
  passToken: string;
  eventSlug: string;
  name: string;
  email: string;
  phone: string;
  /** True once the number was confirmed with a texted code. */
  phoneVerified: boolean;
  /** The demographic answers are null on sign-ups from before they were asked. */
  residentStatus: string | null;
  sex: string | null;
  race: string | null;
  /** YYYY-MM-DD */
  birthdate: string | null;
  occupation: string | null;
  /** Only asked of students. */
  school: string | null;
  /** Friends registered alongside; only earlier sign-ups have any. */
  guests: number;
  dietary: Dietary;
  dietaryNotes: string | null;
  heardFrom: HeardFrom | null;
  /**
   * Agreed to hear about events and programmes when signing up. Everyone who
   * registers under the Terms (/terms) does; earlier sign-ups answered Yes or
   * No. Opting out later is recorded separately (see opt-outs.ts).
   */
  marketingOptIn: boolean;
  status: RegistrationStatus;
  checkedInAt: string | null;
  createdAt: string;
  /** When they were put back on the waitlist (see restore); null for everyone else. */
  queuedAt: string | null;
}

export type NewRegistration = Omit<
  Registration,
  "code" | "passToken" | "status" | "checkedInAt" | "createdAt" | "queuedAt"
>;

export type RegisterResult =
  | { kind: "created"; registration: Registration }
  | { kind: "duplicate"; registration: Registration }
  /** The edition isn't taking sign-ups (any more). */
  | { kind: "closed" };

/** A registration cancelled or deleted, and who got the spots that freed. */
export interface Withdrawal {
  registration: Registration;
  /** Waitlisted guests just given a spot, longest-waiting first. */
  promoted: Registration[];
}

export type GiveSpotResult =
  | { kind: "given"; registration: Registration }
  /** Their party doesn't fit in the spots left. */
  | { kind: "full" }
  /** Not (or no longer) on the waitlist. */
  | { kind: "not-waiting" };

/** Someone who asked for no more updates, by contactKey (see opt-outs.ts). */
export interface OptOut {
  contact: string;
  createdAt: string;
}

export interface Headcount {
  confirmed: number;
  waitlist: number;
}

export interface RegistrationStore {
  /**
   * Atomically checks for an existing sign-up with the same email and places
   * the new one as confirmed or waitlisted. While anyone is waiting, newcomers
   * join the back of the waitlist instead of taking freed spots. Someone
   * re-registering after cancelling gets a fresh code and pass token, so old
   * pass links stop working. Capacity and the registration window come from
   * the edition, read under the same lock.
   */
  register(input: NewRegistration): Promise<RegisterResult>;
  getByCode(code: string): Promise<Registration | null>;
  getByPassToken(token: string): Promise<Registration | null>;
  /**
   * Newest first, in exactly the waitlist's order backwards (queueTime, then
   * the store's tie-break), so the waitlisted ones reversed are the line.
   */
  list(eventSlug: string): Promise<Registration[]>;
  headcount(eventSlug: string): Promise<Headcount>;
  /**
   * "Give a spot": moves a waitlisted guest in, ahead of their turn if need
   * be, as long as their party fits; with `overLimit`, even if it doesn't
   * (the limit stays, so the sign-up form stays full). Runs under the same
   * lock as register.
   */
  giveSpot(code: string, overLimit?: boolean): Promise<GiveSpotResult>;
  /** Checks in a confirmed guest, or undoes a check-in; never changes status. */
  setCheckedIn(code: string, checkedInAt: string | null): Promise<Registration | null>;
  /**
   * Un-cancels a registration, placing it the way a new sign-up would be
   * against its edition's capacity (onto the waitlist means the back of the
   * line: queuedAt is set). Runs under the same lock as register so it can't
   * overbook.
   */
  restore(code: string): Promise<Registration | null>;
  /** Cancels a registration that's still active, then fills from the waitlist. */
  cancel(code: string): Promise<Withdrawal | null>;
  /** The same, for the registration this pass token belongs to. */
  releaseByPassToken(token: string): Promise<Withdrawal | null>;
  /** Deletes a registration for good, then fills from the waitlist. */
  remove(code: string): Promise<Withdrawal | null>;

  /** Everyone who asked for no more updates, newest first. */
  listOptOuts(): Promise<OptOut[]>;
  /** Records an opt-out by contactKey; recording one twice changes nothing. */
  addOptOut(contact: string): Promise<void>;
  removeOptOut(contact: string): Promise<void>;

  /** Every edition, drafts included, soonest first. */
  listEditions(): Promise<Edition[]>;
  getEdition(slug: string): Promise<Edition | null>;
  /** Generates the slug from the start date; one edition per day. */
  createEdition(fields: EditionFields): Promise<CreateEditionResult>;
  /**
   * Applies `patch` unless (with `ifVersion`) the edition has changed since
   * that `updatedAt`, or the result would put two dates on one day: none may
   * share a day with another that isn't called off, and none may move onto a
   * day that has any other date. A change that can open spots (opensSpots)
   * fills from the waitlist in the same step, under the sign-up lock.
   */
  updateEdition(
    slug: string,
    patch: Partial<EditionFields>,
    ifVersion?: string,
  ): Promise<UpdateEditionResult>;
  /** Only drafts nobody has registered for can be deleted. */
  deleteEdition(slug: string): Promise<DeleteEditionResult>;
  /** Back to draft, only while nobody has registered; false otherwise. */
  unpublishEdition(slug: string): Promise<boolean>;
  /** Headcounts for every edition that has registrations, keyed by slug. */
  editionStats(): Promise<Record<string, EditionStats>>;
  putPoster(poster: StoredPoster): Promise<void>;
  /** Deletes every poster no edition shows any more. */
  sweepPosters(): Promise<void>;
  /** The poster's type without its bytes, or null if there's no such poster. */
  posterType(id: string): Promise<StoredPoster["contentType"] | null>;
  getPoster(id: string): Promise<StoredPoster | null>;
}

export const partySize = (r: Pick<Registration, "guests">) => 1 + r.guests;

/** A waitlisted guest's place in line: when they signed up, or were put back. */
export const queueTime = (r: Pick<Registration, "createdAt" | "queuedAt">) =>
  r.queuedAt ?? r.createdAt;

/**
 * Where a party lands right now. While anyone is waiting, freed spots belong
 * to the waitlist, so newcomers queue behind them.
 */
export function placement(
  party: number,
  { confirmed, waiting }: { confirmed: number; waiting: boolean },
  capacity: number | null,
): "confirmed" | "waitlist" {
  return capacity === null || (!waiting && confirmed + party <= capacity)
    ? "confirmed"
    : "waitlist";
}

/**
 * Who gets the free spots: waitlisted parties in sign-up order (`queue` is
 * oldest first), while the next one fits. Nobody is skipped, so a party too
 * big for what's free holds up those behind it.
 */
export function nextInLine<T extends Pick<Registration, "guests">>(
  queue: T[],
  confirmed: number,
  capacity: number | null,
): T[] {
  const given: T[] = [];
  let used = confirmed;
  for (const party of queue) {
    used += partySize(party);
    if (capacity !== null && used > capacity) break;
    given.push(party);
  }
  return given;
}
