// One Backyard date ("edition"). Registrations belong to an edition through
// `Registration.eventSlug`.

export type EditionStatus = "draft" | "published" | "cancelled";

export interface Venue {
  name: string;
  level: string | null;
  address: string;
  directions: string | null;
  mapsUrl: string | null;
}

export interface Poster {
  /** "/poster.webp" or "/posters/<id>.jpg" */
  src: string;
  width: number;
  height: number;
}

export interface Edition {
  /** Generated from the date, never changed; also the ICS UID and CSV name. */
  slug: string;
  status: EditionStatus;
  /** ISO timestamps. */
  startsAt: string;
  endsAt: string;
  /** null: open as soon as it's published. */
  registrationOpensAt: string | null;
  registrationClosesAt: string;
  /** Total people (registrants + guests); null means no cap. */
  capacity: number | null;
  /** Friends one person can bring. */
  maxGuests: number;
  venue: Venue;
  poster: Poster | null;
  /** Shown on the homepage, registration page, passes and emails. */
  notice: string | null;
  createdAt: string;
  updatedAt: string;
}

export type EditionFields = Omit<Edition, "slug" | "createdAt" | "updatedAt">;

export interface StoredPoster {
  id: string;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  width: number;
  height: number;
  bytes: Uint8Array;
}

export type DeleteEditionResult = "deleted" | "not-found" | "not-draft" | "has-registrations";

export interface EditionStats {
  /** Rows of any status, including cancelled ones. */
  registrations: number;
  confirmed: number;
  waitlist: number;
  checkedIn: number;
}
