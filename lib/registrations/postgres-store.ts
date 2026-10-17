import postgres from "postgres";
import { FIRST_EDITION_SEED } from "@/content/series";
import { sameDayEdition, slugFor } from "../editions/plan";
import { isRegistrationOpen } from "../editions/select";
import type { Edition, EditionFields, EditionStats, StoredPoster } from "../editions/types";
import { generateCode, generatePassToken } from "./code";
import {
  partySize,
  placement,
  type Headcount,
  type RegisterResult,
  type Registration,
  type RegistrationPatch,
  type RegistrationStore,
} from "./types";

type Row = {
  code: string;
  pass_token: string;
  event_slug: string;
  name: string;
  email: string;
  phone: string;
  guests: number;
  dietary: Registration["dietary"];
  dietary_notes: string | null;
  heard_from: Registration["heardFrom"];
  marketing_opt_in: boolean;
  status: Registration["status"];
  checked_in_at: Date | null;
  created_at: Date;
};

const toRegistration = (row: Row): Registration => ({
  code: row.code,
  passToken: row.pass_token,
  eventSlug: row.event_slug,
  name: row.name,
  email: row.email,
  phone: row.phone,
  guests: row.guests,
  dietary: row.dietary,
  dietaryNotes: row.dietary_notes,
  heardFrom: row.heard_from,
  marketingOptIn: row.marketing_opt_in,
  status: row.status,
  checkedInAt: row.checked_in_at?.toISOString() ?? null,
  createdAt: row.created_at.toISOString(),
});

type EditionRow = {
  slug: string;
  status: Edition["status"];
  starts_at: Date;
  ends_at: Date;
  registration_opens_at: Date | null;
  registration_closes_at: Date;
  capacity: number | null;
  max_guests: number;
  venue_name: string;
  venue_level: string | null;
  venue_address: string;
  venue_directions: string | null;
  venue_maps_url: string | null;
  poster_src: string | null;
  poster_width: number | null;
  poster_height: number | null;
  notice: string | null;
  called_off_note: string | null;
  created_at: Date;
  updated_at: Date;
};

const toEdition = (row: EditionRow): Edition => ({
  slug: row.slug,
  status: row.status,
  startsAt: row.starts_at.toISOString(),
  endsAt: row.ends_at.toISOString(),
  registrationOpensAt: row.registration_opens_at?.toISOString() ?? null,
  registrationClosesAt: row.registration_closes_at.toISOString(),
  capacity: row.capacity,
  maxGuests: row.max_guests,
  venue: {
    name: row.venue_name,
    level: row.venue_level,
    address: row.venue_address,
    directions: row.venue_directions,
    mapsUrl: row.venue_maps_url,
  },
  poster:
    row.poster_src && row.poster_width && row.poster_height
      ? { src: row.poster_src, width: row.poster_width, height: row.poster_height }
      : null,
  notice: row.notice,
  calledOffNote: row.called_off_note,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});

type EditionColumns = Partial<Omit<EditionRow, "slug" | "created_at" | "updated_at">>;

/** Only the fields present in `fields`, as columns. */
function editionColumns(fields: Partial<EditionFields>): EditionColumns {
  const columns: EditionColumns = {};
  const date = (iso: string) => new Date(iso);
  if (fields.status !== undefined) columns.status = fields.status;
  if (fields.startsAt !== undefined) columns.starts_at = date(fields.startsAt);
  if (fields.endsAt !== undefined) columns.ends_at = date(fields.endsAt);
  if (fields.registrationOpensAt !== undefined) {
    columns.registration_opens_at = fields.registrationOpensAt
      ? date(fields.registrationOpensAt)
      : null;
  }
  if (fields.registrationClosesAt !== undefined) {
    columns.registration_closes_at = date(fields.registrationClosesAt);
  }
  if (fields.capacity !== undefined) columns.capacity = fields.capacity;
  if (fields.maxGuests !== undefined) columns.max_guests = fields.maxGuests;
  if (fields.venue !== undefined) {
    columns.venue_name = fields.venue.name;
    columns.venue_level = fields.venue.level;
    columns.venue_address = fields.venue.address;
    columns.venue_directions = fields.venue.directions;
    columns.venue_maps_url = fields.venue.mapsUrl;
  }
  if (fields.poster !== undefined) {
    columns.poster_src = fields.poster?.src ?? null;
    columns.poster_width = fields.poster?.width ?? null;
    columns.poster_height = fields.poster?.height ?? null;
  }
  if (fields.notice !== undefined) columns.notice = fields.notice;
  if (fields.calledOffNote !== undefined) columns.called_off_note = fields.calledOffNote;
  return columns;
}

type PosterRow = {
  id: string;
  content_type: StoredPoster["contentType"];
  width: number;
  height: number;
  bytes: Buffer;
};

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/**
 * postgres.js forwards query parameters it doesn't know (Supabase's `supa`,
 * Prisma's `pgbouncer`, …) to the server as settings, which the server
 * rejects. Drop them all and set SSL explicitly: off for local databases or
 * `sslmode=disable`, certificate-checked for `sslmode=verify-full`, and
 * encrypted (without CA checks, which Supabase's pooler needs) otherwise.
 */
function connectionOptions(raw: string): {
  url: string;
  ssl: false | "require" | "verify-full";
} {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { url: raw, ssl: "require" };
  }
  const sslmode = url.searchParams.get("sslmode");
  const local = LOCAL_HOSTS.has(url.hostname);
  const ssl =
    sslmode === "verify-full"
      ? "verify-full"
      : sslmode === "disable" || (local && sslmode !== "require")
        ? false
        : "require";
  url.search = "";
  return { url: url.toString(), ssl };
}

export function createPostgresStore(connectionString: string): RegistrationStore {
  const { url, ssl } = connectionOptions(connectionString);
  const sql = postgres(url, {
    ssl,
    max: 5,
    idle_timeout: 20,
    // Keeps transaction-mode poolers (Supabase, Neon pooled URLs) happy.
    prepare: false,
    // "Already exists, skipping" from concurrent setups isn't worth logging.
    onnotice: () => {},
  });

  const migrate = async () => {
    // Already set up? Skip the DDL (and its table locks) on every cold start.
    // Checks for the newest table and column; update it when adding one.
    const [existing] = await sql<{ rls: boolean | null; posters: boolean; latest: boolean }[]>`
      select
        (select relrowsecurity from pg_class where oid = to_regclass('registrations')) as rls,
        to_regclass('posters') is not null as posters,
        exists (
          select 1 from pg_attribute
          where attrelid = to_regclass('editions') and attname = 'called_off_note' and not attisdropped
        ) as latest
    `;
    if (existing?.rls && existing.posters && existing.latest) return;
    await sql.begin(async (tx) => {
      // Concurrent cold starts would otherwise race on CREATE … IF NOT EXISTS.
      await tx`select pg_advisory_xact_lock(hashtext('backyard:migrate'))`;
      await tx`
        create table if not exists registrations (
          id bigserial primary key,
          code text not null unique,
          pass_token text not null unique,
          event_slug text not null,
          name text not null,
          email text not null,
          phone text not null,
          guests integer not null default 0,
          dietary text not null,
          dietary_notes text,
          heard_from text,
          marketing_opt_in boolean not null default false,
          status text not null default 'confirmed',
          checked_in_at timestamptz,
          created_at timestamptz not null default now()
        )
      `;
      await tx`
        create unique index if not exists registrations_event_email
          on registrations (event_slug, lower(email))
      `;
      // Supabase exposes the public schema over its REST API. With RLS on and
      // no policies, only the table owner (this app) can read the guest list.
      await tx`alter table registrations enable row level security`;

      // Each month's date ("edition"). Registrations reference it by event_slug.
      await tx`
        create table if not exists editions (
          slug text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
          status text not null default 'draft'
            check (status in ('draft', 'published', 'cancelled')),
          starts_at timestamptz not null,
          ends_at timestamptz not null,
          registration_opens_at timestamptz,
          registration_closes_at timestamptz not null,
          capacity integer check (capacity is null or capacity between 1 and 1000),
          max_guests integer not null default 3 check (max_guests between 0 and 10),
          venue_name text not null,
          venue_level text,
          venue_address text not null,
          venue_directions text,
          venue_maps_url text,
          poster_src text,
          poster_width integer,
          poster_height integer,
          notice text check (char_length(notice) <= 500),
          called_off_note text check (char_length(called_off_note) <= 500),
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now(),
          check (ends_at > starts_at),
          check (registration_closes_at <= ends_at),
          check (registration_opens_at is null or registration_opens_at < registration_closes_at)
        )
      `;
      // Added after the table first shipped (databases created before it lack it).
      await tx`
        alter table editions add column if not exists called_off_note text
          check (char_length(called_off_note) <= 500)
      `;
      await tx`alter table editions enable row level security`;
      // Sign-ups made before editions existed all belong to this one.
      await tx`
        insert into editions ${tx({ slug: FIRST_EDITION_SEED.slug, ...editionColumns(FIRST_EDITION_SEED) })}
        on conflict (slug) do nothing
      `;

      // Uploaded posters, served by app/posters/[file]/route.ts.
      await tx`
        create table if not exists posters (
          id text primary key,
          content_type text not null
            check (content_type in ('image/jpeg', 'image/png', 'image/webp')),
          width integer not null,
          height integer not null,
          bytes bytea not null,
          created_at timestamptz not null default now()
        )
      `;
      await tx`alter table posters enable row level security`;
    });
  };

  let migrated: Promise<void> | null = null;
  const ready = () =>
    (migrated ??= migrate().catch((error) => {
      migrated = null;
      throw error;
    }));

  return {
    async register(input): Promise<RegisterResult> {
      await ready();
      return sql.begin(async (tx) => {
        // Serialise sign-ups per event so two people can't take the last spot.
        await tx`select pg_advisory_xact_lock(hashtext(${input.eventSlug}))`;

        const [edition] = await tx<EditionRow[]>`
          select * from editions where slug = ${input.eventSlug}
        `;
        if (!edition || !isRegistrationOpen(toEdition(edition), new Date())) {
          return { kind: "closed" };
        }

        const [existing] = await tx<Row[]>`
          select * from registrations
          where event_slug = ${input.eventSlug} and lower(email) = lower(${input.email})
        `;
        if (existing && existing.status !== "cancelled") {
          return { kind: "duplicate", registration: toRegistration(existing) };
        }

        const [{ used, waiting }] = await tx<{ used: number; waiting: number }[]>`
          select
            coalesce(sum(1 + guests) filter (where status = 'confirmed'), 0)::int as used,
            count(*) filter (where status = 'waitlist')::int as waiting
          from registrations where event_slug = ${input.eventSlug}
        `;
        const status = placement(
          partySize(input),
          { confirmed: used, waiting: waiting > 0 },
          edition.capacity,
        );

        // Coming back after cancelling: start over with a new code and pass link.
        if (existing) await tx`delete from registrations where code = ${existing.code}`;

        const values = {
          event_slug: input.eventSlug,
          name: input.name,
          email: input.email,
          phone: input.phone,
          guests: input.guests,
          dietary: input.dietary,
          dietary_notes: input.dietaryNotes,
          heard_from: input.heardFrom,
          marketing_opt_in: input.marketingOptIn,
          status,
        };

        for (let attempt = 0; ; attempt++) {
          const [row] = await tx<Row[]>`
            insert into registrations ${tx({
              ...values,
              code: generateCode(),
              pass_token: generatePassToken(),
            })}
            on conflict (code) do nothing
            returning *
          `;
          if (row) return { kind: "created", registration: toRegistration(row) };
          if (attempt >= 5) throw new Error("Could not allocate a unique code");
        }
      });
    },

    async getByCode(code) {
      await ready();
      const [row] = await sql<Row[]>`select * from registrations where code = ${code}`;
      return row ? toRegistration(row) : null;
    },

    async getByPassToken(token) {
      await ready();
      const [row] = await sql<Row[]>`select * from registrations where pass_token = ${token}`;
      return row ? toRegistration(row) : null;
    },

    async list(eventSlug) {
      await ready();
      const rows = await sql<Row[]>`
        select * from registrations where event_slug = ${eventSlug}
        order by created_at desc
      `;
      return rows.map(toRegistration);
    },

    async headcount(eventSlug): Promise<Headcount> {
      await ready();
      const [row] = await sql<Headcount[]>`
        select
          coalesce(sum(1 + guests) filter (where status = 'confirmed'), 0)::int as confirmed,
          coalesce(sum(1 + guests) filter (where status = 'waitlist'), 0)::int as waitlist
        from registrations where event_slug = ${eventSlug}
      `;
      return row;
    },

    async update(code, patch: RegistrationPatch) {
      await ready();
      const set: Partial<Pick<Row, "status" | "checked_in_at">> = {};
      if (patch.status !== undefined) set.status = patch.status;
      if (patch.checkedInAt !== undefined) {
        set.checked_in_at = patch.checkedInAt ? new Date(patch.checkedInAt) : null;
      }
      if (Object.keys(set).length === 0) return this.getByCode(code);
      const [row] = await sql<Row[]>`
        update registrations set ${sql(set)} where code = ${code} returning *
      `;
      return row ? toRegistration(row) : null;
    },

    async setCheckedIn(code, checkedInAt) {
      await ready();
      // Only confirmed guests can be checked in; waitlisted ones need "Give a spot" first.
      const [row] = checkedInAt
        ? await sql<Row[]>`
            update registrations set checked_in_at = ${new Date(checkedInAt)}
            where code = ${code} and status = 'confirmed'
            returning *
          `
        : await sql<Row[]>`
            update registrations set checked_in_at = null
            where code = ${code} and status <> 'cancelled'
            returning *
          `;
      return row ? toRegistration(row) : null;
    },

    async restore(code) {
      await ready();
      return sql.begin(async (tx) => {
        const [found] = await tx<Row[]>`select event_slug from registrations where code = ${code}`;
        if (!found) return null;
        await tx`select pg_advisory_xact_lock(hashtext(${found.event_slug}))`;
        const [row] = await tx<Row[]>`select * from registrations where code = ${code}`;
        if (!row || row.status !== "cancelled") return null;
        const [edition] = await tx<Pick<EditionRow, "capacity">[]>`
          select capacity from editions where slug = ${row.event_slug}
        `;
        const capacity = edition ? edition.capacity : null;
        const [{ used, waiting }] = await tx<{ used: number; waiting: number }[]>`
          select
            coalesce(sum(1 + guests) filter (where status = 'confirmed'), 0)::int as used,
            count(*) filter (where status = 'waitlist')::int as waiting
          from registrations where event_slug = ${row.event_slug}
        `;
        const status = placement(partySize(row), { confirmed: used, waiting: waiting > 0 }, capacity);
        const [updated] = await tx<Row[]>`
          update registrations set status = ${status} where code = ${code} returning *
        `;
        return toRegistration(updated);
      });
    },

    async releaseByPassToken(token) {
      await ready();
      const [row] = await sql<Row[]>`
        update registrations set status = 'cancelled', checked_in_at = null
        where pass_token = ${token} and status <> 'cancelled'
        returning *
      `;
      return row ? toRegistration(row) : null;
    },

    async remove(code) {
      await ready();
      const rows = await sql`delete from registrations where code = ${code} returning code`;
      return rows.length > 0;
    },

    async listEditions() {
      await ready();
      const rows = await sql<EditionRow[]>`select * from editions order by starts_at`;
      return rows.map(toEdition);
    },

    async getEdition(slug) {
      await ready();
      const [row] = await sql<EditionRow[]>`select * from editions where slug = ${slug}`;
      return row ? toEdition(row) : null;
    },

    async createEdition(fields) {
      await ready();
      return sql.begin(async (tx) => {
        // Two organisers planning the same month mustn't race for one slug or day.
        await tx`select pg_advisory_xact_lock(hashtext('backyard:editions'))`;
        const existing = (await tx<EditionRow[]>`select * from editions`).map(toEdition);
        const clash = sameDayEdition(existing, fields.startsAt);
        if (clash) return { kind: "date-taken" as const, edition: clash };
        const slug = slugFor(fields.startsAt, new Set(existing.map((e) => e.slug)));
        const [row] = await tx<EditionRow[]>`
          insert into editions ${tx({ slug, ...editionColumns(fields) })} returning *
        `;
        return { kind: "created" as const, edition: toEdition(row) };
      });
    },

    async updateEdition(slug, patch, ifVersion) {
      await ready();
      const columns = editionColumns(patch);
      if (Object.keys(columns).length === 0) return this.getEdition(slug);
      // updated_at can hold microseconds (now()); versions are milliseconds.
      const [row] = await sql<EditionRow[]>`
        update editions set ${sql({ ...columns, updated_at: new Date() })}
        where slug = ${slug}
        ${ifVersion ? sql`and date_trunc('milliseconds', updated_at) = ${new Date(ifVersion)}` : sql``}
        returning *
      `;
      return row ? toEdition(row) : null;
    },

    async deleteEdition(slug) {
      await ready();
      return sql.begin(async (tx) => {
        // The same lock as register, so nobody signs up mid-delete.
        await tx`select pg_advisory_xact_lock(hashtext(${slug}))`;
        const [edition] = await tx<Pick<EditionRow, "status" | "poster_src">[]>`
          select status, poster_src from editions where slug = ${slug}
        `;
        if (!edition) return "not-found";
        if (edition.status !== "draft") return "not-draft";
        const [{ count }] = await tx<{ count: number }[]>`
          select count(*)::int as count from registrations where event_slug = ${slug}
        `;
        if (count > 0) return "has-registrations";
        await tx`delete from editions where slug = ${slug}`;
        // Its poster too, unless another date shows the same image.
        const posterId = /^\/posters\/([0-9a-f]{32})\./.exec(edition.poster_src ?? "")?.[1];
        if (posterId) {
          await tx`
            delete from posters where id = ${posterId}
              and not exists (select 1 from editions where poster_src like ${`/posters/${posterId}.%`})
          `;
        }
        return "deleted";
      });
    },

    async unpublishEdition(slug) {
      await ready();
      return sql.begin(async (tx) => {
        // The same lock as register, so nobody signs up for a date as it's hidden.
        await tx`select pg_advisory_xact_lock(hashtext(${slug}))`;
        const [{ count }] = await tx<{ count: number }[]>`
          select count(*)::int as count from registrations where event_slug = ${slug}
        `;
        if (count > 0) return false;
        const rows = await tx`
          update editions set status = 'draft', updated_at = now()
          where slug = ${slug} and status = 'published' returning slug
        `;
        return rows.length > 0;
      });
    },

    async editionStats() {
      await ready();
      const rows = await sql<(EditionStats & { event_slug: string })[]>`
        select
          event_slug,
          count(*)::int as registrations,
          coalesce(sum(1 + guests) filter (where status = 'confirmed'), 0)::int as confirmed,
          coalesce(sum(1 + guests) filter (where status = 'waitlist'), 0)::int as waitlist,
          coalesce(sum(1 + guests) filter (where status = 'confirmed' and checked_in_at is not null), 0)::int
            as "checkedIn"
        from registrations group by event_slug
      `;
      return Object.fromEntries(rows.map(({ event_slug, ...stats }) => [event_slug, stats]));
    },

    async putPoster(poster) {
      await ready();
      await sql`
        insert into posters ${sql({
          id: poster.id,
          content_type: poster.contentType,
          width: poster.width,
          height: poster.height,
          bytes: Buffer.from(poster.bytes),
        })}
        on conflict (id) do nothing
      `;
    },

    async deletePosterIfUnused(id) {
      await ready();
      await sql`
        delete from posters where id = ${id}
          and not exists (select 1 from editions where poster_src like ${`/posters/${id}.%`})
      `;
    },

    async getPoster(id) {
      await ready();
      const [row] = await sql<PosterRow[]>`select * from posters where id = ${id}`;
      return row
        ? {
            id: row.id,
            contentType: row.content_type,
            width: row.width,
            height: row.height,
            bytes: new Uint8Array(row.bytes),
          }
        : null;
    },
  };
}
