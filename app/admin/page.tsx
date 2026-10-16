import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { event } from "@/content/event";
import { requireAdmin } from "@/lib/admin-auth";
import { eventDateLong } from "@/lib/format";
import {
  DIETARY_OPTIONS,
  getCapacity,
  getStore,
  HEARD_FROM_OPTIONS,
  partySize,
  StoreNotConfiguredError,
  type Registration,
} from "@/lib/registrations";
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
            <a href="/admin/export" className="btn btn-outline px-4 py-2 text-sm text-forest">
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
  const heardFrom = [
    ...HEARD_FROM_OPTIONS.map((o) => ({
      label: o.label,
      value: active.filter((r) => r.heardFrom === o.value).length,
    })),
    { label: "Didn’t say", value: active.filter((r) => !r.heardFrom).length },
  ];

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

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <Breakdown
          title="Dietary (confirmed people)"
          rows={dietary}
          footnote={`Each party picks one option for everyone; ${
            confirmed.filter((r) => r.dietaryNotes).length
          } parties added notes, so check those in the list.`}
        />
        <Breakdown title="Heard about us via" rows={heardFrom} />
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
          <li key={row.label} className="grid grid-cols-[8.5rem_1fr_2.5rem] items-center gap-3 text-sm">
            <span className="truncate text-ink">{row.label}</span>
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
