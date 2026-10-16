export const DIETARY_OPTIONS = [
  { value: "none", label: "No restrictions" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "halal", label: "Halal" },
  { value: "no-beef", label: "No beef" },
  { value: "other", label: "Other" },
] as const;

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
  code: string;
  eventSlug: string;
  name: string;
  email: string;
  phone: string;
  guests: number;
  dietary: Dietary;
  dietaryNotes: string | null;
  heardFrom: HeardFrom | null;
  marketingOptIn: boolean;
  status: RegistrationStatus;
  checkedInAt: string | null;
  createdAt: string;
}

export type NewRegistration = Omit<
  Registration,
  "code" | "status" | "checkedInAt" | "createdAt"
>;

export type RegisterResult =
  | { kind: "created"; registration: Registration }
  | { kind: "duplicate"; registration: Registration };

export type RegistrationPatch = Partial<
  Pick<Registration, "status" | "checkedInAt">
>;

export interface Headcount {
  confirmed: number;
  waitlist: number;
}

export interface RegistrationStore {
  /**
   * Atomically checks for an existing sign-up with the same email and places
   * the new one as confirmed or waitlisted depending on remaining capacity.
   */
  register(
    input: NewRegistration,
    capacity: number | null,
  ): Promise<RegisterResult>;
  getByCode(code: string): Promise<Registration | null>;
  list(eventSlug: string): Promise<Registration[]>;
  headcount(eventSlug: string): Promise<Headcount>;
  update(code: string, patch: RegistrationPatch): Promise<Registration | null>;
  remove(code: string): Promise<boolean>;
}

export const partySize = (r: Pick<Registration, "guests">) => 1 + r.guests;
