import postgres from "postgres";
import { FIRST_EDITION_SEED } from "@/content/series";
import { dayClash, sameDayEdition, slugFor } from "../editions/plan";
import { fillsFromWaitlist, isRegistrationOpen, opensSpots } from "../editions/select";
import type { Edition, EditionFields, EditionStats, StoredPoster } from "../editions/types";
import { generateCode, generatePassToken } from "./code";
import {
  nextInLine,
  partySize,
  placement,
  type GiveSpotResult,
  type Headcount,
  type OptOut,
  type RegisterResult,
  type Registration,
  type RegistrationStore,
  type Withdrawal,
} from "./types";

type Row = {
  code: string;
  pass_token: string;
  event_slug: string;
  name: string;
  email: string;
  phone: string;
  phone_verified: boolean;
  resident_status: string | null;
  sex: string | null;
  race: string | null;
  birthdate: Date | null;
  occupation: string | null;
  school: string | null;
  guests: number;
  dietary: Registration["dietary"];
  dietary_notes: string | null;
  heard_from: Registration["heardFrom"];
  marketing_opt_in: boolean;
  status: Registration["status"];
  checked_in_at: Date | null;
  created_at: Date;
  queued_at: Date | null;
};

const toRegistration = (row: Row): Registration => ({
  code: row.code,
  passToken: row.pass_token,
  eventSlug: row.event_slug,
  name: row.name,
  email: row.email,
  phone: row.phone,
  phoneVerified: row.phone_verified,
  residentStatus: row.resident_status,
  sex: row.sex,
  race: row.race,
  // Dates arrive as UTC midnight.
  birthdate: row.birthdate?.toISOString().slice(0, 10) ?? null,
  occupation: row.occupation,
  school: row.school,
  guests: row.guests,
  dietary: row.dietary,
  dietaryNotes: row.dietary_notes,
  heardFrom: row.heard_from,
  marketingOptIn: row.marketing_opt_in,
  status: row.status,
  checkedInAt: row.checked_in_at?.toISOString() ?? null,
  createdAt: row.created_at.toISOString(),
  queuedAt: row.queued_at?.toISOString() ?? null,
});

type EditionRow = {
  slug: string;
  status: Edition["status"];
  starts_at: Date;
  ends_at: Date;
  registration_opens_at: Date | null;
  registration_closes_at: Date;
  capacity: number | null;
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

  // Checks for the newest table and columns; update it when adding one.
  const upToDate = async (q: postgres.ISql) => {
    const [existing] = await q<
      { rls: boolean | null; posters: boolean; opt_outs: boolean; latest: boolean }[]
    >`
      select
        (select relrowsecurity from pg_class where oid = to_regclass('registrations')) as rls,
        to_regclass('posters') is not null as posters,
        to_regclass('marketing_opt_outs') is not null as opt_outs,
        exists (
          select 1 from pg_attribute
          where attrelid = to_regclass('editions') and attname = 'called_off_note' and not attisdropped
        ) and exists (
          select 1 from pg_attribute
          where attrelid = to_regclass('registrations') and attname = 'queued_at' and not attisdropped
        ) as latest
    `;
    return Boolean(existing?.rls && existing.posters && existing.opt_outs && existing.latest);
  };

  const migrate = async () => {
    // Already up to date? Skip the DDL (and its table locks) on every cold start.
    if (await upToDate(sql)) return;
    await sql.begin(async (tx) => {
      // Concurrent cold starts would otherwise race on CREATE … IF NOT EXISTS.
      await tx`select pg_advisory_xact_lock(hashtext('backyard:migrate'))`;
      // Another instance may have finished it while we waited.
      if (await upToDate(tx)) return;
      // ALTER TABLE locks a table even with nothing to change. A deployment
      // still serving sign-ups holds editions while it reads registrations,
      // so locking editions after registrations here could deadlock with it.
      const [editionsHave] = await tx<{ existed: boolean; note: boolean; rls: boolean }[]>`
        select
          to_regclass('editions') is not null as existed,
          exists (
            select 1 from pg_attribute
            where attrelid = to_regclass('editions') and attname = 'called_off_note' and not attisdropped
          ) as note,
          coalesce((select relrowsecurity from pg_class where oid = to_regclass('editions')), false) as rls
      `;
      await tx`
        create table if not exists registrations (
          id bigserial primary key,
          code text not null unique,
          pass_token text not null unique,
          event_slug text not null,
          name text not null,
          email text not null,
          phone text not null,
          phone_verified boolean not null default false,
          resident_status text,
          sex text,
          race text,
          birthdate date,
          occupation text,
          school text,
          guests integer not null default 0,
          dietary text not null,
          dietary_notes text,
          heard_from text,
          marketing_opt_in boolean not null default false,
          status text not null default 'confirmed',
          checked_in_at timestamptz,
          created_at timestamptz not null default now(),
          queued_at timestamptz
        )
      `;
      // Columns added since launch, for tables created before them.
      await tx`
        alter table registrations
          add column if not exists phone_verified boolean not null default false,
          add column if not exists resident_status text,
          add column if not exists sex text,
          add column if not exists race text,
          add column if not exists birthdate date,
          add column if not exists occupation text,
          add column if not exists school text,
          add column if not exists queued_at timestamptz
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
          -- Unused since everyone registers for themselves; kept for older deployments.
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
      if (!editionsHave.note) {
        await tx`
          alter table editions add column if not exists called_off_note text
            check (char_length(called_off_note) <= 500)
        `;
      }
      if (!editionsHave.rls) await tx`alter table editions enable row level security`;
      // Sign-ups made before editions existed all belong to this one. Only for
      // a new table: on an old one the insert would wait on any change to that
      // row by a deployment still running, while holding registrations.
      if (!editionsHave.existed) {
        await tx`
          insert into editions ${tx({ slug: FIRST_EDITION_SEED.slug, ...editionColumns(FIRST_EDITION_SEED) })}
          on conflict (slug) do nothing
        `;
      }

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

      // Email addresses and numbers that asked for no more updates (opt-outs.ts).
      await tx`
        create table if not exists marketing_opt_outs (
          contact text primary key,
          created_at timestamptz not null default now()
        )
      `;
      await tx`alter table marketing_opt_outs enable row level security`;
    });
  };

  let migrated: Promise<void> | null = null;
  const ready = () =>
    (migrated ??= migrate().catch((error) => {
      migrated = null;
      throw error;
    }));

  // Everything that changes who's confirmed holds this per-event lock, so two
  // people can't take the last spot.
  const lockEvent = (tx: postgres.TransactionSql, slug: string) =>
    tx`select pg_advisory_xact_lock(hashtext(${slug}))`;

  /** People confirmed for `slug`, and how many sign-ups are waiting. */
  const occupancy = async (tx: postgres.TransactionSql, slug: string) => {
    const [row] = await tx<{ used: number; waiting: number }[]>`
      select
        coalesce(sum(1 + guests) filter (where status = 'confirmed'), 0)::int as used,
        count(*) filter (where status = 'waitlist')::int as waiting
      from registrations where event_slug = ${slug}
    `;
    return row;
  };

  /** Gives free spots on `slug` to its waitlist. Call holding lockEvent. */
  const fill = async (tx: postgres.TransactionSql, slug: string) => {
    const [edition] = await tx<EditionRow[]>`select * from editions where slug = ${slug}`;
    if (!edition || !fillsFromWaitlist(toEdition(edition), new Date())) return [];
    const { used } = await occupancy(tx, slug);
    const queue = await tx<Row[]>`
      select * from registrations where event_slug = ${slug} and status = 'waitlist'
      order by coalesce(queued_at, created_at), id
    `;
    const promoted: Registration[] = [];
    for (const row of nextInLine(queue, used, edition.capacity)) {
      const [updated] = await tx<Row[]>`
        update registrations set status = 'confirmed' where code = ${row.code} returning *
      `;
      promoted.push(toRegistration(updated));
    }
    return promoted;
  };

  /** Cancels or deletes a registration, then fills the spot it freed. */
  const withdraw = (code: string, remove: boolean) =>
    sql.begin(async (tx): Promise<Withdrawal | null> => {
      const [found] = await tx<Pick<Row, "event_slug">[]>`
        select event_slug from registrations where code = ${code}
      `;
      if (!found) return null;
      await lockEvent(tx, found.event_slug);
      const [row] = remove
        ? await tx<Row[]>`delete from registrations where code = ${code} returning *`
        : await tx<Row[]>`
            update registrations set status = 'cancelled', checked_in_at = null
            where code = ${code} and status <> 'cancelled'
            returning *
          `;
      if (!row) return null;
      return { registration: toRegistration(row), promoted: await fill(tx, row.event_slug) };
    });

  return {
    async register(input): Promise<RegisterResult> {
      await ready();
      return sql.begin(async (tx) => {
        await lockEvent(tx, input.eventSlug);

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

        const { used, waiting } = await occupancy(tx, input.eventSlug);
        const status = placement(
          partySize(input),
          { confirmed: used, waiting: waiting > 0 },
          edition.capacity,
        );

        // Coming back after cancelling: start over with a new code and pass link.
        if (existing) await tx`delete from registrations where code = ${existing.code}`;

        // Read under the lock, not at BEGIN (now()), so the waitlist runs in
        // the order people were placed on it, as for restore. As text, to
        // keep the microseconds a Date would drop.
        const [{ placedAt }] = await tx<{ placedAt: string }[]>`
          select clock_timestamp()::text as "placedAt"
        `;

        const values = {
          event_slug: input.eventSlug,
          name: input.name,
          email: input.email,
          phone: input.phone,
          phone_verified: input.phoneVerified,
          resident_status: input.residentStatus,
          sex: input.sex,
          race: input.race,
          birthdate: input.birthdate,
          occupation: input.occupation,
          school: input.school,
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
              created_at: placedAt,
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
        order by coalesce(queued_at, created_at) desc, id desc
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

    async giveSpot(code, overLimit = false) {
      await ready();
      return sql.begin(async (tx): Promise<GiveSpotResult> => {
        const [found] = await tx<Pick<Row, "event_slug">[]>`
          select event_slug from registrations where code = ${code}
        `;
        if (!found) return { kind: "not-waiting" };
        await lockEvent(tx, found.event_slug);
        const [row] = await tx<Row[]>`select * from registrations where code = ${code}`;
        if (!row || row.status !== "waitlist") return { kind: "not-waiting" };
        const [edition] = await tx<Pick<EditionRow, "capacity">[]>`
          select capacity from editions where slug = ${row.event_slug}
        `;
        const capacity = edition ? edition.capacity : null;
        const { used } = await occupancy(tx, row.event_slug);
        if (!overLimit && capacity !== null && used + partySize(row) > capacity) {
          return { kind: "full" };
        }
        const [updated] = await tx<Row[]>`
          update registrations set status = 'confirmed' where code = ${code} returning *
        `;
        return { kind: "given", registration: toRegistration(updated) };
      });
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
        await lockEvent(tx, found.event_slug);
        const [row] = await tx<Row[]>`select * from registrations where code = ${code}`;
        if (!row || row.status !== "cancelled") return null;
        const [edition] = await tx<Pick<EditionRow, "capacity">[]>`
          select capacity from editions where slug = ${row.event_slug}
        `;
        const capacity = edition ? edition.capacity : null;
        const { used, waiting } = await occupancy(tx, row.event_slug);
        const status = placement(partySize(row), { confirmed: used, waiting: waiting > 0 }, capacity);
        // Like a new sign-up, back on the waitlist means the back of the line.
        const [updated] =
          status === "waitlist"
            ? await tx<Row[]>`
                update registrations set status = 'waitlist', queued_at = clock_timestamp()
                where code = ${code} returning *
              `
            : await tx<Row[]>`
                update registrations set status = ${status} where code = ${code} returning *
              `;
        return toRegistration(updated);
      });
    },

    async cancel(code) {
      await ready();
      return withdraw(code, false);
    },

    async releaseByPassToken(token) {
      await ready();
      const [row] = await sql<Pick<Row, "code">[]>`
        select code from registrations where pass_token = ${token}
      `;
      return row ? withdraw(row.code, false) : null;
    },

    async remove(code) {
      await ready();
      return withdraw(code, true);
    },

    async listOptOuts() {
      await ready();
      const rows = await sql<{ contact: string; created_at: Date }[]>`
        select contact, created_at from marketing_opt_outs order by created_at desc
      `;
      return rows.map((row): OptOut => ({
        contact: row.contact,
        createdAt: row.created_at.toISOString(),
      }));
    },

    async addOptOut(contact) {
      await ready();
      await sql`
        insert into marketing_opt_outs (contact) values (${contact})
        on conflict (contact) do nothing
      `;
    },

    async removeOptOut(contact) {
      await ready();
      await sql`delete from marketing_opt_outs where contact = ${contact}`;
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
      return sql.begin(async (tx) => {
        // The sign-up lock first, in the same order as unpublish and delete,
        // so a new limit and the fill it allows land as one.
        await lockEvent(tx, slug);
        // The same lock as createEdition: day checks see every other change.
        await tx`select pg_advisory_xact_lock(hashtext('backyard:editions'))`;
        // And the row itself, so an unpublish or delete can't land in between.
        const [locked] = await tx`select slug from editions where slug = ${slug} for update`;
        if (!locked) return { kind: "not-found" as const };
        const editions = (await tx<EditionRow[]>`select * from editions`).map(toEdition);
        const current = editions.find((e) => e.slug === slug);
        if (!current) return { kind: "not-found" as const };
        if (ifVersion && current.updatedAt !== ifVersion) return { kind: "changed" as const };
        const clash = dayClash(editions, current, { ...current, ...patch });
        if (clash) return { kind: "date-taken" as const, edition: clash };
        if (Object.keys(columns).length === 0) {
          return { kind: "updated" as const, edition: current, promoted: [] };
        }
        const [row] = await tx<EditionRow[]>`
          update editions set ${tx({ ...columns, updated_at: new Date() })}
          where slug = ${slug} returning *
        `;
        if (!row) return { kind: "not-found" as const };
        const promoted = opensSpots(patch) ? await fill(tx, slug) : [];
        return { kind: "updated" as const, edition: toEdition(row), promoted };
      });
    },

    async deleteEdition(slug) {
      await ready();
      const result = await sql.begin(async (tx) => {
        // The same lock as register, so nobody signs up mid-delete.
        await lockEvent(tx, slug);
        const [edition] = await tx<Pick<EditionRow, "status">[]>`
          select status from editions where slug = ${slug}
        `;
        if (!edition) return "not-found" as const;
        if (edition.status !== "draft") return "not-draft" as const;
        const [{ count }] = await tx<{ count: number }[]>`
          select count(*)::int as count from registrations where event_slug = ${slug}
        `;
        if (count > 0) return "has-registrations" as const;
        await tx`delete from editions where slug = ${slug}`;
        return "deleted" as const;
      });
      // Its poster too, unless another date shows the same image.
      if (result === "deleted") await this.sweepPosters();
      return result;
    },

    async unpublishEdition(slug) {
      await ready();
      return sql.begin(async (tx) => {
        // The same lock as register, so nobody signs up for a date as it's hidden.
        await lockEvent(tx, slug);
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

    async sweepPosters() {
      await ready();
      await sql`
        delete from posters p
        where not exists (select 1 from editions where poster_src like '/posters/' || p.id || '.%')
      `;
    },

    async posterType(id) {
      await ready();
      const [row] = await sql<Pick<PosterRow, "content_type">[]>`
        select content_type from posters where id = ${id}
      `;
      return row?.content_type ?? null;
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
