import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/admin-auth";
import { hasEnded } from "@/lib/editions/select";
import type { Edition, EditionStats } from "@/lib/editions/types";
import { eventDateLong, eventTimeRange } from "@/lib/format";
import { getStore } from "@/lib/registrations";
import { AdminHeader } from "../admin-header";
import { EditionBadge } from "../edition-badge";

export const metadata: Metadata = {
  title: "Dates",
  robots: { index: false, follow: false },
};

export default function EditionsPage() {
  return (
    <>
      <AdminHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <Suspense fallback={<div className="mt-8 h-64 animate-pulse rounded-2xl bg-forest/10" />}>
          <Editions />
        </Suspense>
      </main>
    </>
  );
}

async function Editions() {
  await requireAdmin();
  const store = getStore();
  const [editions, stats] = await Promise.all([store.listEditions(), store.editionStats()]);
  const now = new Date();
  const upcoming = editions.filter((e) => !hasEnded(e, now));
  const past = editions.filter((e) => hasEnded(e, now)).reverse();

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl text-forest">Dates</h1>
          <p className="mt-1 max-w-xl text-muted">
            Each Backyard has its own date, venue, poster and guest list. Drafts stay hidden
            until you publish them; the homepage moves on to the next date once one ends.
          </p>
        </div>
        <Link href="/admin/editions/new" className="btn btn-primary px-5 py-3">
          Plan next month <span aria-hidden="true">→</span>
        </Link>
      </div>

      <h2 className="mt-10 font-bold text-forest">Coming up</h2>
      {upcoming.length ? (
        <EditionList editions={upcoming} stats={stats} now={now} />
      ) : (
        <p className="mt-3 rounded-2xl border-2 border-dashed border-forest/20 p-6 text-muted">
          Nothing planned yet. The homepage says the next date is coming soon.
        </p>
      )}

      {past.length > 0 && (
        <details className="mt-10">
          <summary className="cursor-pointer font-bold text-forest">Past dates ({past.length})</summary>
          <EditionList editions={past} stats={stats} now={now} />
        </details>
      )}
    </>
  );
}

function EditionList({
  editions,
  stats,
  now,
}: {
  editions: Edition[];
  stats: Record<string, EditionStats>;
  now: Date;
}) {
  return (
    <ul className="mt-3 divide-y-2 divide-forest/10 overflow-hidden rounded-2xl border-2 border-forest/15 bg-card">
      {editions.map((edition) => {
        const s = stats[edition.slug];
        const over = hasEnded(edition, now);
        const headcount = !s
          ? "No sign-ups yet"
          : over
            ? `${s.checkedIn} checked in · ${s.confirmed} confirmed`
            : `${s.confirmed}${edition.capacity ? `/${edition.capacity}` : ""} coming${s.waitlist ? ` · ${s.waitlist} waiting` : ""}`;
        return (
          <li
            key={edition.slug}
            className="grid gap-3 p-4 md:grid-cols-[1fr_auto] md:items-center"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/admin/editions/${edition.slug}`}
                  className="text-lg font-bold text-ink hover:text-forest hover:underline"
                >
                  {eventDateLong(edition)}
                </Link>
                <EditionBadge edition={edition} now={now} stats={s} />
              </div>
              <p className="mt-1 text-sm text-muted">
                {eventTimeRange(edition)} · {edition.venue.name} · {headcount}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 md:justify-end">
              <Link
                href={`/admin?edition=${edition.slug}`}
                className="rounded-full border-2 border-forest/20 px-4 py-2 text-sm font-bold text-forest hover:border-forest"
              >
                Guests
              </Link>
              <Link
                href={`/admin/editions/${edition.slug}`}
                className="rounded-full border-2 border-forest/20 px-4 py-2 text-sm font-bold text-forest hover:border-forest"
              >
                Edit
              </Link>
              <Link
                href={`/admin/editions/new?from=${edition.slug}`}
                className="rounded-full px-3 py-2 text-sm font-semibold text-muted hover:text-forest"
              >
                Copy to next month
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
