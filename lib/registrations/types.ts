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
  /** Short, human-readable code shown on the pass for check-in. */
  code: string;
  /** Unguessable secret in the pass URL; it alone can view or release the spot. */
  passToken: string;
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
  "code" | "passToken" | "status" | "checkedInAt" | "createdAt"
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
   * the new one as confirmed or waitlisted. While anyone is waiting, newcomers
   * join the back of the waitlist instead of taking freed spots. Someone
   * re-registering after cancelling gets a fresh code and pass token, so old
   * pass links stop working.
   */
  register(
    input: NewRegistration,
    capacity: number | null,
  ): Promise<RegisterResult>;
  getByCode(code: string): Promise<Registration | null>;
  getByPassToken(token: string): Promise<Registration | null>;
  list(eventSlug: string): Promise<Registration[]>;
  headcount(eventSlug: string): Promise<Headcount>;
  update(code: string, patch: RegistrationPatch): Promise<Registration | null>;
  /** Checks in a confirmed guest, or undoes a check-in; never changes status. */
  setCheckedIn(code: string, checkedInAt: string | null): Promise<Registration | null>;
  /** Cancels the registration this pass token belongs to, if still active. */
  releaseByPassToken(token: string): Promise<Registration | null>;
  remove(code: string): Promise<boolean>;
}

export const partySize = (r: Pick<Registration, "guests">) => 1 + r.guests;

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
