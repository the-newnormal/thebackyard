import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { FIRST_EDITION_SEED } from "@/content/series";
import { slugFor } from "../editions/plan";
import { isRegistrationOpen } from "../editions/select";
import type { Edition, EditionStats, StoredPoster } from "../editions/types";
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

const DIR = path.join(process.cwd(), ".data");
const FILE = path.join(DIR, "registrations.json");
const EDITIONS = path.join(DIR, "editions.json");
const POSTERS = path.join(DIR, "posters");

let queue: Promise<unknown> = Promise.resolve();

/** Runs `fn` after every previously queued operation, one at a time. */
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

async function readJson<T>(file: string, fallback: () => T): Promise<T> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback();
    throw error;
  }
}

async function writeJson(file: string, value: unknown) {
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await writeFile(tmp, JSON.stringify(value, null, 2));
  await rename(tmp, file);
}

const load = () => readJson<Registration[]>(FILE, () => []);
const save = (rows: Registration[]) => writeJson(FILE, rows);

/** Same starting point as a new Postgres database: the first edition. */
function seedEdition(): Edition {
  const iso = (value: string) => new Date(value).toISOString();
  return {
    ...FIRST_EDITION_SEED,
    startsAt: iso(FIRST_EDITION_SEED.startsAt),
    endsAt: iso(FIRST_EDITION_SEED.endsAt),
    registrationClosesAt: iso(FIRST_EDITION_SEED.registrationClosesAt),
    venue: { ...FIRST_EDITION_SEED.venue },
    poster: { ...FIRST_EDITION_SEED.poster },
    createdAt: iso(FIRST_EDITION_SEED.startsAt),
    updatedAt: iso(FIRST_EDITION_SEED.startsAt),
  };
}

const byStart = (a: Edition, b: Edition) => a.startsAt.localeCompare(b.startsAt);
const loadEditions = async () =>
  (await readJson<Edition[]>(EDITIONS, () => [seedEdition()]))
    .map((e) => ({ ...e, calledOffNote: e.calledOffNote ?? null }))
    .sort(byStart);
const saveEditions = (editions: Edition[]) => writeJson(EDITIONS, editions);

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
    register: (input: NewRegistration) =>
      exclusive(async (): Promise<RegisterResult> => {
        const edition = (await loadEditions()).find((e) => e.slug === input.eventSlug);
        if (!edition || !isRegistrationOpen(edition, new Date())) return { kind: "closed" };
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
        const status = placement(
          partySize(input),
          { confirmed: used, waiting },
          edition.capacity,
        );

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

    restore: (code) =>
      exclusive(async () => {
        const rows = await load();
        const index = rows.findIndex((r) => r.code === code && r.status === "cancelled");
        if (index === -1) return null;
        const slug = rows[index].eventSlug;
        const edition = (await loadEditions()).find((e) => e.slug === slug);
        const capacity = edition ? edition.capacity : null;
        const status = placement(
          partySize(rows[index]),
          {
            confirmed: confirmedHeadcount(rows, slug),
            waiting: rows.some((r) => r.eventSlug === slug && r.status === "waitlist"),
          },
          capacity,
        );
        rows[index] = { ...rows[index], status };
        await save(rows);
        return rows[index];
      }),

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

    listEditions: loadEditions,

    async getEdition(slug) {
      return (await loadEditions()).find((e) => e.slug === slug) ?? null;
    },

    createEdition: (fields) =>
      exclusive(async () => {
        const editions = await loadEditions();
        const now = new Date().toISOString();
        const edition: Edition = {
          ...fields,
          slug: slugFor(fields.startsAt, new Set(editions.map((e) => e.slug))),
          createdAt: now,
          updatedAt: now,
        };
        await saveEditions([...editions, edition]);
        return edition;
      }),

    updateEdition: (slug, patch) =>
      exclusive(async () => {
        const editions = await loadEditions();
        const index = editions.findIndex((e) => e.slug === slug);
        if (index === -1) return null;
        editions[index] = { ...editions[index], ...patch, updatedAt: new Date().toISOString() };
        await saveEditions(editions);
        return editions[index];
      }),

    deleteEdition: (slug) =>
      exclusive(async () => {
        const editions = await loadEditions();
        const edition = editions.find((e) => e.slug === slug);
        if (!edition) return "not-found";
        if (edition.status !== "draft") return "not-draft";
        if ((await load()).some((r) => r.eventSlug === slug)) return "has-registrations";
        await saveEditions(editions.filter((e) => e !== edition));
        return "deleted";
      }),

    unpublishEdition: (slug) =>
      exclusive(async () => {
        if ((await load()).some((r) => r.eventSlug === slug)) return false;
        const editions = await loadEditions();
        const index = editions.findIndex((e) => e.slug === slug && e.status === "published");
        if (index === -1) return false;
        editions[index] = { ...editions[index], status: "draft", updatedAt: new Date().toISOString() };
        await saveEditions(editions);
        return true;
      }),

    async editionStats() {
      const stats: Record<string, EditionStats> = {};
      for (const r of await load()) {
        const s = (stats[r.eventSlug] ??= { registrations: 0, confirmed: 0, waitlist: 0, checkedIn: 0 });
        s.registrations++;
        if (r.status === "confirmed") s.confirmed += partySize(r);
        if (r.status === "waitlist") s.waitlist += partySize(r);
        if (r.status === "confirmed" && r.checkedInAt) s.checkedIn += partySize(r);
      }
      return stats;
    },

    async putPoster({ bytes, ...meta }) {
      await mkdir(POSTERS, { recursive: true });
      await writeFile(path.join(POSTERS, `${meta.id}.bin`), bytes);
      await writeJson(path.join(POSTERS, `${meta.id}.json`), meta);
    },

    deletePosterIfUnused: (id) =>
      exclusive(async () => {
        const used = (await loadEditions()).some((e) => e.poster?.src.startsWith(`/posters/${id}.`));
        if (used) return;
        await rm(path.join(POSTERS, `${id}.bin`), { force: true });
        await rm(path.join(POSTERS, `${id}.json`), { force: true });
      }),

    async getPoster(id) {
      const meta = await readJson<Omit<StoredPoster, "bytes"> | null>(
        path.join(POSTERS, `${id}.json`),
        () => null,
      );
      if (!meta) return null;
      return { ...meta, bytes: new Uint8Array(await readFile(path.join(POSTERS, `${id}.bin`))) };
    },
  };
}
