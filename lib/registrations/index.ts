import "server-only";
import { event } from "@/content/event";
import { createFileStore } from "./file-store";
import { createPostgresStore } from "./postgres-store";
import type { RegistrationStore } from "./types";

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
  const fromEnv = Number.parseInt(process.env.EVENT_CAPACITY ?? "", 10);
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : event.capacity;
}

export function isRegistrationOpen(now: Date): boolean {
  if (process.env.REGISTRATION_OPEN === "false") return false;
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
  const { confirmed } = await getStore().headcount(event.slug);
  const spotsLeft = capacity - confirmed;
  return spotsLeft > 0 ? { state: "open", spotsLeft } : { state: "waitlist" };
}
