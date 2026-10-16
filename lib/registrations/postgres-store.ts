import postgres from "postgres";
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
  });

  const migrate = async () => {
    // Already set up? Skip the DDL (and its table lock) on every cold start.
    const [existing] = await sql<{ rls: boolean }[]>`
      select relrowsecurity as rls from pg_class where oid = to_regclass('registrations')
    `;
    if (existing?.rls) return;
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
    });
  };

  let migrated: Promise<void> | null = null;
  const ready = () =>
    (migrated ??= migrate().catch((error) => {
      migrated = null;
      throw error;
    }));

  return {
    async register(input, capacity): Promise<RegisterResult> {
      await ready();
      return sql.begin(async (tx) => {
        // Serialise sign-ups per event so two people can't take the last spot.
        await tx`select pg_advisory_xact_lock(hashtext(${input.eventSlug}))`;

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
          capacity,
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

    async restore(code, capacity) {
      await ready();
      return sql.begin(async (tx) => {
        const [found] = await tx<Row[]>`select event_slug from registrations where code = ${code}`;
        if (!found) return null;
        await tx`select pg_advisory_xact_lock(hashtext(${found.event_slug}))`;
        const [row] = await tx<Row[]>`select * from registrations where code = ${code}`;
        if (!row || row.status !== "cancelled") return null;
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
  };
}
