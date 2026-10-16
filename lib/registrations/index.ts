import "server-only";
import { event } from "@/content/event";
import { createFileStore } from "./file-store";
import { createPostgresStore } from "./postgres-store";
import { placement, type RegistrationStore } from "./types";

export * from "./types";

let store: RegistrationStore | null = null;

export class StoreNotConfiguredError extends Error {
  constructor() {
    super(
      "No database configured. Set DATABASE_URL (or POSTGRES_URL) to a Postgres connection string.",
    );
  }
}

const databaseUrl = () => process.env.DATABASE_URL || process.env.POSTGRES_URL;

/** False on Vercel until a database is connected. */
export function isStoreConfigured(): boolean {
  return Boolean(databaseUrl()) || !process.env.VERCEL;
}

export function getStore(): RegistrationStore {
  if (store) return store;
  const url = databaseUrl();
  if (url) return (store = createPostgresStore(url));
  // A file on a serverless filesystem would silently lose sign-ups.
  if (process.env.VERCEL) throw new StoreNotConfiguredError();
  return (store = createFileStore());
}

export function getCapacity(): number | null {
  const raw = process.env.EVENT_CAPACITY?.trim();
  if (!raw) return event.capacity;
  if (/^\d+$/.test(raw)) return Number(raw);
  console.error(`Ignoring EVENT_CAPACITY=${JSON.stringify(raw)}: expected a whole number`);
  return event.capacity;
}

export function isRegistrationOpen(now: Date): boolean {
  const flag = process.env.REGISTRATION_OPEN?.trim().toLowerCase();
  if (flag === "false" || flag === "0" || flag === "no") return false;
  return now < new Date(event.registrationClosesAt);
}


export type Availability =
  | { state: "open"; spotsLeft: number | null }
  | { state: "waitlist" }
  | { state: "closed" };

export async function getAvailability(now: Date): Promise<Availability> {
  if (!isRegistrationOpen(now)) return { state: "closed" };
  const capacity = getCapacity();
  if (capacity === null) return { state: "open", spotsLeft: null };
  const { confirmed, waitlist } = await getStore().headcount(event.slug);
  return placement(1, { confirmed, waiting: waitlist > 0 }, capacity) === "confirmed"
    ? { state: "open", spotsLeft: capacity - confirmed }
    : { state: "waitlist" };
}
