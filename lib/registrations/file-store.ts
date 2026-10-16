import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { generateCode, generatePassToken } from "./code";
import {
  partySize,
  placement,
  type NewRegistration,
  type RegisterResult,
  type Registration,
  type RegistrationStore,
} from "./types";

// Local-development store: a JSON file in .data/. Not for production —
// serverless filesystems are read-only and not shared between instances.

const FILE = path.join(process.cwd(), ".data", "registrations.json");

let queue: Promise<unknown> = Promise.resolve();

/** Runs `fn` after every previously queued operation, one at a time. */
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

async function load(): Promise<Registration[]> {
  try {
    return JSON.parse(await readFile(FILE, "utf8")) as Registration[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function save(rows: Registration[]) {
  await mkdir(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.tmp`;
  await writeFile(tmp, JSON.stringify(rows, null, 2));
  await rename(tmp, FILE);
}

const confirmedHeadcount = (rows: Registration[], slug: string) =>
  rows
    .filter((r) => r.eventSlug === slug && r.status === "confirmed")
    .reduce((sum, r) => sum + partySize(r), 0);

/** Applies `change` to the row matching `match` and saves; null if none matched. */
const updateWhere = (
  match: (r: Registration) => boolean,
  change: (r: Registration) => Registration,
) =>
  exclusive(async () => {
    const rows = await load();
    const index = rows.findIndex(match);
    if (index === -1) return null;
    rows[index] = change(rows[index]);
    await save(rows);
    return rows[index];
  });

export function createFileStore(): RegistrationStore {
  return {
    register: (input: NewRegistration, capacity) =>
      exclusive(async (): Promise<RegisterResult> => {
        const rows = await load();
        const email = input.email.toLowerCase();
        const existing = rows.find(
          (r) => r.eventSlug === input.eventSlug && r.email.toLowerCase() === email,
        );
        if (existing && existing.status !== "cancelled") {
          return { kind: "duplicate", registration: existing };
        }

        const used = confirmedHeadcount(rows, input.eventSlug);
        const waiting = rows.some(
          (r) => r.eventSlug === input.eventSlug && r.status === "waitlist",
        );
        const status = placement(partySize(input), { confirmed: used, waiting }, capacity);

        let code = generateCode();
        while (rows.some((r) => r.code === code)) code = generateCode();

        const registration: Registration = {
          ...input,
          code,
          passToken: generatePassToken(),
          status,
          checkedInAt: null,
          createdAt: new Date().toISOString(),
        };
        // Coming back after cancelling: start over with a new code and pass link.
        const next = rows.filter((r) => r !== existing);
        await save([...next, registration]);
        return { kind: "created", registration };
      }),

    async getByCode(code) {
      return (await load()).find((r) => r.code === code) ?? null;
    },

    async getByPassToken(token) {
      return (await load()).find((r) => r.passToken === token) ?? null;
    },

    async list(eventSlug) {
      return (await load())
        .filter((r) => r.eventSlug === eventSlug)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    async headcount(eventSlug) {
      const rows = (await load()).filter((r) => r.eventSlug === eventSlug);
      const sum = (status: Registration["status"]) =>
        rows.filter((r) => r.status === status).reduce((s, r) => s + partySize(r), 0);
      return { confirmed: sum("confirmed"), waitlist: sum("waitlist") };
    },

    update: (code, patch) =>
      updateWhere(
        (r) => r.code === code,
        (r) => ({ ...r, ...patch }),
      ),

    setCheckedIn: (code, checkedInAt) =>
      updateWhere(
        (r) => r.code === code && (checkedInAt ? r.status === "confirmed" : r.status !== "cancelled"),
        (r) => ({ ...r, checkedInAt }),
      ),

    releaseByPassToken: (token) =>
      updateWhere(
        (r) => r.passToken === token && r.status !== "cancelled",
        (r) => ({ ...r, status: "cancelled", checkedInAt: null }),
      ),

    remove: (code) =>
      exclusive(async () => {
        const rows = await load();
        const next = rows.filter((r) => r.code !== code);
        if (next.length === rows.length) return false;
        await save(next);
        return true;
      }),
  };
}
