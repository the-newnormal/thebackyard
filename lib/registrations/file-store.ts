import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { FIRST_EDITION_SEED } from "@/content/series";
import { dayClash, sameDayEdition, slugFor } from "../editions/plan";
import { fillsFromWaitlist, isRegistrationOpen, opensSpots } from "../editions/select";
import type { Edition, EditionStats, StoredPoster } from "../editions/types";
import { generateCode, generatePassToken } from "./code";
import {
  nextInLine,
  partySize,
  placement,
  queueTime,
  type GiveSpotResult,
  type NewRegistration,
  type OptOut,
  type RegisterResult,
  type Registration,
  type RegistrationStore,
  type WalkInResult,
  type Withdrawal,
} from "./types";

// Local-development store: a JSON file in .data/. Not for production —
// serverless filesystems are read-only and not shared between instances.

const DIR = path.join(process.cwd(), ".data");
const FILE = path.join(DIR, "registrations.json");
const EDITIONS = path.join(DIR, "editions.json");
const POSTERS = path.join(DIR, "posters");
const OPT_OUTS = path.join(DIR, "opt-outs.json");

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

// Fields added since launch, for rows saved before them.
const LATER_FIELDS = {
  phoneVerified: false,
  residentStatus: null,
  sex: null,
  race: null,
  birthdate: null,
  occupation: null,
  school: null,
  queuedAt: null,
  walkIn: false,
  age: null,
} satisfies Partial<Registration>;

const load = async () =>
  (await readJson<Registration[]>(FILE, () => [])).map((row) => ({ ...LATER_FIELDS, ...row }));
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
const loadOptOuts = () => readJson<OptOut[]>(OPT_OUTS, () => []);

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

/** Gives free spots on `slug` to its waitlist, changing `rows`. Call inside exclusive(). */
async function fill(rows: Registration[], slug: string): Promise<Registration[]> {
  const edition = (await loadEditions()).find((e) => e.slug === slug);
  if (!edition || !fillsFromWaitlist(edition, new Date())) return [];
  const queue = rows
    .filter((r) => r.eventSlug === slug && r.status === "waitlist")
    .sort((a, b) => queueTime(a).localeCompare(queueTime(b)));
  return nextInLine(queue, confirmedHeadcount(rows, slug), edition.capacity).map((r) => {
    const promoted: Registration = { ...r, status: "confirmed" };
    rows[rows.indexOf(r)] = promoted;
    return promoted;
  });
}

/** Cancels or deletes the first registration matching `match`, then fills the spot it freed. */
const withdraw = (match: (r: Registration) => boolean, remove: boolean) =>
  exclusive(async (): Promise<Withdrawal | null> => {
    const rows = await load();
    const index = rows.findIndex((r) => match(r) && (remove || r.status !== "cancelled"));
    if (index === -1) return null;
    const registration: Registration = remove
      ? rows[index]
      : { ...rows[index], status: "cancelled", checkedInAt: null };
    if (remove) rows.splice(index, 1);
    else rows[index] = registration;
    const promoted = await fill(rows, registration.eventSlug);
    await save(rows);
    return { registration, promoted };
  });

/** Deletes posters no edition shows. Call inside exclusive(). */
async function sweep() {
  const used = new Set(
    (await loadEditions()).flatMap((e) => /^\/posters\/([0-9a-f]{32})\./.exec(e.poster?.src ?? "")?.[1] ?? []),
  );
  let files: string[];
  try {
    files = await readdir(POSTERS);
  } catch {
    return;
  }
  for (const file of files) {
    const id = file.split(".")[0];
    if (!used.has(id)) await rm(path.join(POSTERS, file), { force: true });
  }
}

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
          queuedAt: null,
          walkIn: false,
          age: null,
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
      // The waitlist's order (as fill sorts it), backwards.
      return (await load())
        .filter((r) => r.eventSlug === eventSlug)
        .sort((a, b) => queueTime(a).localeCompare(queueTime(b)))
        .reverse();
    },

    async headcount(eventSlug) {
      const rows = (await load()).filter((r) => r.eventSlug === eventSlug);
      const sum = (status: Registration["status"]) =>
        rows.filter((r) => r.status === status).reduce((s, r) => s + partySize(r), 0);
      return { confirmed: sum("confirmed"), waitlist: sum("waitlist") };
    },

    giveSpot: (code, overLimit = false) =>
      exclusive(async (): Promise<GiveSpotResult> => {
        const rows = await load();
        const index = rows.findIndex((r) => r.code === code && r.status === "waitlist");
        if (index === -1) return { kind: "not-waiting" };
        const slug = rows[index].eventSlug;
        const edition = (await loadEditions()).find((e) => e.slug === slug);
        const capacity = edition ? edition.capacity : null;
        const fits =
          capacity === null || confirmedHeadcount(rows, slug) + partySize(rows[index]) <= capacity;
        if (!fits && !overLimit) {
          return { kind: "full" };
        }
        rows[index] = { ...rows[index], status: "confirmed" };
        await save(rows);
        return { kind: "given", registration: rows[index] };
      }),

    addWalkIn: (input) =>
      exclusive(async (): Promise<WalkInResult> => {
        const edition = (await loadEditions()).find((e) => e.slug === input.eventSlug);
        if (edition?.status !== "published") return { kind: "closed" };
        const rows = await load();
        const email = input.email.toLowerCase();
        const index = email
          ? rows.findIndex((r) => r.eventSlug === input.eventSlug && r.email.toLowerCase() === email)
          : -1;
        const now = new Date().toISOString();
        if (index !== -1 && rows[index].status !== "cancelled") {
          return { kind: "duplicate", registration: rows[index] };
        }
        // Signed up, cancelled, then came anyway: keep what they told us then.
        if (index !== -1) {
          rows[index] = { ...rows[index], status: "confirmed", checkedInAt: now, queuedAt: null };
          await save(rows);
          return { kind: "restored", registration: rows[index] };
        }

        let code = generateCode();
        while (rows.some((r) => r.code === code)) code = generateCode();
        const registration: Registration = {
          ...LATER_FIELDS,
          ...input,
          code,
          passToken: generatePassToken(),
          guests: 0,
          dietaryNotes: null,
          heardFrom: null,
          status: "confirmed",
          checkedInAt: now,
          createdAt: now,
          walkIn: true,
        };
        await save([...rows, registration]);
        return { kind: "added", registration };
      }),

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
        rows[index] = {
          ...rows[index],
          status,
          // Like a new sign-up, back on the waitlist means the back of the line.
          ...(status === "waitlist" ? { queuedAt: new Date().toISOString() } : {}),
        };
        await save(rows);
        return rows[index];
      }),

    cancel: (code) => withdraw((r) => r.code === code, false),

    releaseByPassToken: (token) => withdraw((r) => r.passToken === token, false),

    remove: (code) => withdraw((r) => r.code === code, true),

    async listOptOuts() {
      return (await loadOptOuts()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    addOptOut: (contact) =>
      exclusive(async () => {
        const optOuts = await loadOptOuts();
        if (optOuts.some((o) => o.contact === contact)) return;
        await writeJson(OPT_OUTS, [...optOuts, { contact, createdAt: new Date().toISOString() }]);
      }),

    removeOptOut: (contact) =>
      exclusive(async () => {
        const optOuts = await loadOptOuts();
        await writeJson(OPT_OUTS, optOuts.filter((o) => o.contact !== contact));
      }),

    listEditions: loadEditions,

    async getEdition(slug) {
      return (await loadEditions()).find((e) => e.slug === slug) ?? null;
    },

    createEdition: (fields) =>
      exclusive(async () => {
        const editions = await loadEditions();
        const clash = sameDayEdition(editions, fields.startsAt);
        if (clash) return { kind: "date-taken" as const, edition: clash };
        const now = new Date().toISOString();
        const edition: Edition = {
          ...fields,
          slug: slugFor(fields.startsAt, new Set(editions.map((e) => e.slug))),
          createdAt: now,
          updatedAt: now,
        };
        await saveEditions([...editions, edition]);
        return { kind: "created" as const, edition };
      }),

    updateEdition: (slug, patch, ifVersion) =>
      exclusive(async () => {
        const editions = await loadEditions();
        const index = editions.findIndex((e) => e.slug === slug);
        if (index === -1) return { kind: "not-found" as const };
        const current = editions[index];
        if (ifVersion && current.updatedAt !== ifVersion) return { kind: "changed" as const };
        const clash = dayClash(editions, current, { ...current, ...patch });
        if (clash) return { kind: "date-taken" as const, edition: clash };
        editions[index] = { ...current, ...patch, updatedAt: new Date().toISOString() };
        await saveEditions(editions);
        const rows = await load();
        const promoted = opensSpots(patch) ? await fill(rows, slug) : [];
        if (promoted.length > 0) await save(rows);
        return { kind: "updated" as const, edition: editions[index], promoted };
      }),

    deleteEdition: (slug) =>
      exclusive(async () => {
        const editions = await loadEditions();
        const edition = editions.find((e) => e.slug === slug);
        if (!edition) return "not-found";
        if (edition.status !== "draft") return "not-draft";
        if ((await load()).some((r) => r.eventSlug === slug)) return "has-registrations";
        await saveEditions(editions.filter((e) => e !== edition));
        await sweep();
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

    sweepPosters: () => exclusive(sweep),

    async posterType(id) {
      const meta = await readJson<Omit<StoredPoster, "bytes"> | null>(
        path.join(POSTERS, `${id}.json`),
        () => null,
      );
      return meta?.contentType ?? null;
    },

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
