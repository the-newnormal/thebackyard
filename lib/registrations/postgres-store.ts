import postgres from "postgres";
import { generateCode } from "./code";
import {
  partySize,
  type Headcount,
  type RegisterResult,
  type Registration,
  type RegistrationPatch,
  type RegistrationStore,
} from "./types";

type Row = {
  code: string;
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

export function createPostgresStore(url: string): RegistrationStore {
  const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  const sql = postgres(url, {
    ssl: isLocal ? false : "require",
    max: 5,
    idle_timeout: 20,
    // Keeps transaction-mode poolers (Supabase, Neon pooled URLs) happy.
    prepare: false,
  });

  let migrated: Promise<unknown> | null = null;
  const ready = () =>
    (migrated ??= sql`
      create table if not exists registrations (
        id bigserial primary key,
        code text not null unique,
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
      );
      create unique index if not exists registrations_event_email
        on registrations (event_slug, lower(email));
    `
      .simple()
      .catch((error) => {
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

        const [{ used }] = await tx<{ used: number }[]>`
          select coalesce(sum(1 + guests), 0)::int as used from registrations
          where event_slug = ${input.eventSlug} and status = 'confirmed'
        `;
        const status =
          capacity === null || used + partySize(input) <= capacity
            ? "confirmed"
            : "waitlist";

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

        if (existing) {
          // Coming back after cancelling: reuse the row (and their code).
          const [row] = await tx<Row[]>`
            update registrations
            set ${tx(values)}, checked_in_at = null, created_at = now()
            where code = ${existing.code}
            returning *
          `;
          return { kind: "created", registration: toRegistration(row) };
        }

        for (let attempt = 0; ; attempt++) {
          const [row] = await tx<Row[]>`
            insert into registrations ${tx({ ...values, code: generateCode() })}
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

    async remove(code) {
      await ready();
      const rows = await sql`delete from registrations where code = ${code} returning code`;
      return rows.length > 0;
    },
  };
}
