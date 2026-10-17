import "server-only";
import { isRegistrationOpen } from "../editions/select";
import type { Edition } from "../editions/types";
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

export type Availability =
  | { state: "open"; spotsLeft: number | null }
  | { state: "waitlist" }
  | { state: "closed" };

export async function getAvailability(edition: Edition, now: Date): Promise<Availability> {
  if (!isRegistrationOpen(edition, now)) return { state: "closed" };
  const { capacity } = edition;
  if (capacity === null) return { state: "open", spotsLeft: null };
  const { confirmed, waitlist } = await getStore().headcount(edition.slug);
  return placement(1, { confirmed, waiting: waitlist > 0 }, capacity) === "confirmed"
    ? { state: "open", spotsLeft: capacity - confirmed }
    : { state: "waitlist" };
}
