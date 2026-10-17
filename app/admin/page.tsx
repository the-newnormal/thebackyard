import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { event } from "@/content/event";
import {
  MAIN_RACES,
  OCCUPATIONS,
  RESIDENT_STATUSES,
  SEXES,
} from "@/content/registration-options";
import { requireAdmin } from "@/lib/admin-auth";
import { isEmailConfigured } from "@/lib/email";
import { eventDateLong } from "@/lib/format";
import {
  DIETARY_OPTIONS,
  getCapacity,
  getStore,
  partySize,
  StoreNotConfiguredError,
  type Registration,
} from "@/lib/registrations";
import { AGE_GROUPS, ageGroup, ageOnEventDay } from "@/lib/registrations/demographics";
import { RegistrationList } from "./registration-list";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <>
      <header className="border-b-2 border-forest/10 bg-paper/90">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-baseline gap-3">
            <Link href="/" className="font-display text-2xl text-forest">
              BACKYARD
            </Link>
            <span className="font-serif text-xl text-muted italic">dashboard</span>
          </div>
          <div className="flex items-center gap-2">
            <a href="/admin/export" className="btn btn-outline px-4 py-2 text-sm">
              Export CSV
            </a>
            {/* A full page load on sign-out, so no guest data lingers in the page. */}
            <form method="post" action="/admin/logout">
              <button type="submit" className="btn px-4 py-2 text-sm text-muted hover:text-red">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <h1 className="font-heading text-3xl text-forest">{event.name}</h1>
        <p className="mt-1 text-muted">{eventDateLong()}</p>
        <Suspense fallback={<DashboardSkeleton />}>
          <Dashboard />
        </Suspense>
      </main>
    </>
  );
}

async function Dashboard() {
  await requireAdmin();

  let registrations: Registration[];
  try {
    registrations = await getStore().list(event.slug);
  } catch (error) {
    if (error instanceof StoreNotConfiguredError) {
      return (
        <p className="mt-8 rounded-2xl border-2 border-red bg-red/10 p-5 font-semibold text-red">
          {error.message}
        </p>
      );
    }
    throw error;
  }

  const active = registrations.filter((r) => r.status !== "cancelled");
  const people = (rows: Registration[]) => rows.reduce((sum, r) => sum + partySize(r), 0);
  const confirmed = active.filter((r) => r.status === "confirmed");
  const waitlist = active.filter((r) => r.status === "waitlist");
  const checkedIn = active.filter((r) => r.checkedInAt);
  const capacity = getCapacity();

  // Food prep is for people who are actually coming.
  const dietary = DIETARY_OPTIONS.map((o) => ({
    label: o.label,
    value: people(confirmed.filter((r) => r.dietary === o.value)),
  }));

  // Who's signed up, one count per registration. Sign-ups from before these
  // questions were asked show as "Not asked".
  const tally = (labels: readonly string[], answer: (r: Registration) => string | null) => {
    const rows = labels.map((label) => ({
      label,
      value: active.filter((r) => answer(r) === label).length,
    }));
    const notAsked = active.filter((r) => answer(r) === null).length;
    return notAsked ? [...rows, { label: "Not asked", value: notAsked }] : rows;
  };
  const mainRaces: readonly string[] = MAIN_RACES;
  const age = (r: Registration) => {
    const years = ageOnEventDay(r);
    return years === null ? null : ageGroup(years);
  };
  const bySchool = new Map<string, number>();
  for (const r of active) if (r.school) bySchool.set(r.school, (bySchool.get(r.school) ?? 0) + 1);
  const schools = [...bySchool]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  return (
    <>
      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Coming (people)"
          value={people(confirmed)}
          note={
            capacity
              ? `of ${capacity} · ${Math.max(0, capacity - people(confirmed))} free`
              : `${confirmed.length} sign-ups`
          }
          tone="bg-forest text-cream"
        />
        <Stat
          label="Checked in"
          value={people(checkedIn)}
          note={`${checkedIn.length} sign-ups`}
          tone="bg-lime text-forest-deep"
        />
        <Stat
          label="Waitlist (people)"
          value={people(waitlist)}
          note={`${waitlist.length} sign-ups`}
          tone="bg-mustard text-forest-deep"
        />
        <Stat
          label="Want updates"
          value={active.filter((r) => r.marketingOptIn).length}
          note="opted in"
          tone="bg-card text-forest border-2 border-forest/15"
        />
      </div>

      {waitlist.length > 0 && !isEmailConfigured() && (
        <p className="mt-3 rounded-2xl bg-mustard/30 px-5 py-4 text-ink">
          Emails are off, so “Give a spot” doesn’t notify anyone. Message the guest yourself —
          their email and phone are in the list below.
        </p>
      )}

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <Breakdown
          title="Dietary (confirmed people)"
          rows={dietary}
          footnote={`Each party picks one option for everyone; ${
            confirmed.filter((r) => r.dietaryNotes).length
          } parties added notes, so check those in the list.`}
        />
        <Breakdown title="Occupation" rows={tally(OCCUPATIONS, (r) => r.occupation)} />
        <Breakdown
          title="Age on the day"
          rows={tally(
            AGE_GROUPS.map((g) => g.label),
            age,
          )}
        />
        <Breakdown
          title="Residency"
          rows={tally(RESIDENT_STATUSES, (r) => r.residentStatus)}
        />
        <Breakdown title="Sex" rows={tally(SEXES, (r) => r.sex)} />
        <Breakdown
          title="Race"
          rows={tally(MAIN_RACES, (r) =>
            r.race && !mainRaces.includes(r.race) ? "Others" : r.race,
          )}
          footnote="Others includes everyone who picked a more specific race."
        />
        {schools.length > 0 && (
          <Breakdown title="Top schools" rows={schools} footnote="Students only." />
        )}
      </div>

      <RegistrationList registrations={registrations} />
    </>
  );
}

function Stat({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: number;
  note: string;
  tone: string;
}) {
  return (
    <div className={`rounded-2xl p-5 ${tone}`}>
      <p className="text-sm font-semibold opacity-80">{label}</p>
      <p className="mt-1 font-display text-5xl tabular-nums">{value}</p>
      <p className="mt-1 text-sm opacity-75">{note}</p>
    </div>
  );
}

function Breakdown({
  title,
  rows,
  footnote,
}: {
  title: string;
  rows: { label: string; value: number }[];
  footnote?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <section className="rounded-2xl border-2 border-forest/15 bg-card p-5">
      <h2 className="font-bold text-forest">{title}</h2>
      <ul className="mt-3 space-y-2">
        {rows.map((row) => (
          <li key={row.label} className="grid grid-cols-[10.5rem_1fr_2.5rem] items-center gap-3 text-sm">
            <span className="truncate text-ink" title={row.label}>
              {row.label}
            </span>
            <span className="h-2.5 overflow-hidden rounded-full bg-forest/10">
              <span
                className="block h-full rounded-full bg-orange"
                style={{ width: `${(row.value / max) * 100}%` }}
              />
            </span>
            <span className="text-right font-semibold tabular-nums">{row.value}</span>
          </li>
        ))}
      </ul>
      {footnote && <p className="mt-3 text-sm text-muted">{footnote}</p>}
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <div className="mt-8 animate-pulse space-y-3" aria-busy="true" aria-label="Loading dashboard">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-32 rounded-2xl bg-forest/10" />
        ))}
      </div>
      <div className="h-64 rounded-2xl bg-forest/10" />
    </div>
  );
}
