import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ConfirmButton } from "@/components/confirm-button";
import { requireAdmin } from "@/lib/admin-auth";
import { toFormValues } from "@/lib/editions/plan";
import { featured, hasEnded } from "@/lib/editions/select";
import type { Edition } from "@/lib/editions/types";
import { eventDateLong, eventDateShort } from "@/lib/format";
import { getStore } from "@/lib/registrations";
import { AdminHeader } from "../../admin-header";
import { EditionBadge } from "../../edition-badge";
import { deleteEdition, setEditionStatus } from "../actions";
import { EditionForm } from "../edition-form";
import { PosterUpload } from "../poster-upload";

export const metadata: Metadata = {
  title: "Edit date",
  robots: { index: false, follow: false },
};

export default function EditionPage({ params, searchParams }: PageProps<"/admin/editions/[slug]">) {
  return (
    <>
      <AdminHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        <Link href="/admin/editions" className="text-sm font-semibold text-forest hover:underline">
          ← All dates
        </Link>
        <Suspense fallback={<div className="mt-8 h-96 animate-pulse rounded-2xl bg-forest/10" />}>
          <EditEdition params={params} searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}

const CALLED_OFF_NOTE = "The PSI forecast is in the unhealthy range. Stay safe!";

async function EditEdition({
  params,
  searchParams,
}: Pick<PageProps<"/admin/editions/[slug]">, "params" | "searchParams">) {
  await requireAdmin();
  const { slug } = await params;
  const { saved } = await searchParams;
  const store = getStore();
  const [editions, stats] = await Promise.all([store.listEditions(), store.editionStats()]);
  const edition = editions.find((e) => e.slug === slug);
  if (!edition) notFound();
  const now = new Date();
  const registrations = stats[slug]?.registrations ?? 0;
  const confirmed = stats[slug]?.confirmed ?? 0;
  const waiting = stats[slug]?.waitlist ?? 0;

  return (
    <>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="font-heading text-3xl text-forest">{eventDateLong(edition)}</h1>
        <EditionBadge edition={edition} now={now} stats={stats[slug]} />
      </div>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <Link href={`/admin?edition=${slug}`} className="font-semibold text-forest underline underline-offset-4">
          Guest list ({confirmed} coming{waiting ? `, ${waiting} waiting` : ""})
        </Link>
        <span className="text-muted">ID: {slug}</span>
      </p>

      {((saved === "published" && edition.status === "published") ||
        (saved === "draft" && edition.status === "draft")) && (
        <p role="status" className="mt-6 rounded-2xl bg-lime/40 px-5 py-4 font-semibold text-forest-deep">
          {saved === "published"
            ? `Published. ${whenPublic(edition, editions, now)} Add a poster below.`
            : "Saved as a draft. Add a poster, then publish when you’re ready."}
        </p>
      )}

      <section className="mt-8 rounded-2xl border-2 border-forest bg-card p-5 sm:p-6">
        <h2 className="font-heading text-sm tracking-widest text-orange-ink uppercase">Status</h2>
        <StatusPanel edition={edition} editions={editions} registrations={registrations} now={now} />
      </section>

      <section className="mt-6 rounded-2xl border-2 border-forest/15 bg-card p-5 sm:p-6">
        <h2 className="mb-4 font-heading text-sm tracking-widest text-orange-ink uppercase">Poster</h2>
        <PosterUpload slug={slug} poster={edition.poster} />
      </section>

      <h2 className="mt-10 mb-4 font-heading text-2xl text-forest">Details</h2>
      {confirmed + waiting > 0 && (
        <p className="mb-6 rounded-2xl bg-mustard/30 px-5 py-4 text-ink">
          {confirmed + waiting} {confirmed + waiting === 1 ? "person is" : "people are"} signed
          up (friends and waitlist included). Their passes update automatically, but if you
          change the date, time or venue, let them know too: their emails are in the CSV on the
          guest list.
        </p>
      )}
      <EditionForm slug={slug} version={edition.updatedAt} initial={toFormValues(edition)} />
    </>
  );
}

/** When a newly published date shows up on the homepage. */
function whenPublic(edition: Edition, editions: Edition[], now: Date): string {
  const current = featured(editions, now);
  return current && current.slug !== edition.slug
    ? `It takes over the homepage once ${eventDateShort(current)} ends.`
    : "It’s on the homepage now.";
}

function StatusPanel({
  edition,
  editions,
  registrations,
  now,
}: {
  edition: Edition;
  editions: Edition[];
  registrations: number;
  now: Date;
}) {
  const ended = hasEnded(edition, now);
  const button = (status: string, label: string, confirm: string, primary = false) => (
    <form action={setEditionStatus}>
      <input type="hidden" name="slug" value={edition.slug} />
      <input type="hidden" name="status" value={status} />
      <ConfirmButton
        confirm={confirm}
        className={`btn px-5 py-2.5 text-sm ${primary ? "btn-primary" : "btn-outline"}`}
      >
        {label}
      </ConfirmButton>
    </form>
  );

  if (edition.status === "draft") {
    const future = new Date(edition.startsAt) > now;
    return (
      <div className="mt-3 space-y-4">
        <p className="text-ink">Only organisers can see this date.</p>
        <div className="flex flex-wrap items-center gap-3">
          {future ? (
            button(
              "published",
              "Publish",
              `Publish ${eventDateShort(edition)}? ${whenPublic(edition, [...editions.filter((e) => e.slug !== edition.slug), { ...edition, status: "published" }], now)}`,
              true,
            )
          ) : (
            <p className="text-sm text-muted">This date has passed, so it can’t be published.</p>
          )}
          {registrations === 0 && (
            <form action={deleteEdition}>
              <input type="hidden" name="slug" value={edition.slug} />
              <ConfirmButton
                confirm="Delete this draft? This can't be undone."
                className="rounded-full px-3 py-2 text-sm font-semibold text-muted hover:text-red"
              >
                Delete draft
              </ConfirmButton>
            </form>
          )}
        </div>
      </div>
    );
  }

  if (edition.status === "cancelled") {
    return (
      <div className="mt-3 space-y-4">
        <p className="text-ink">
          Called off. Guests see this on the homepage and their passes; their registrations are
          kept.
        </p>
        {edition.calledOffNote && (
          <p className="rounded-xl bg-red/5 px-4 py-3 text-ink">“{edition.calledOffNote}”</p>
        )}
        {!ended &&
          button(
            "published",
            "It’s back on",
            "Put this date back on? Guests' passes go back to normal.",
          )}
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-4">
      <p className="text-ink">
        {ended ? "This date is over." : "Published: it’s on the website and taking sign-ups as scheduled."}
      </p>
      {!ended && (
        <form action={setEditionStatus} className="space-y-3 rounded-xl bg-red/5 p-4">
          <input type="hidden" name="slug" value={edition.slug} />
          <input type="hidden" name="status" value="cancelled" />
          <label className="block">
            <span className="mb-2 block font-bold text-red">Call it off (haze, weather…)</span>
            <textarea
              name="calledOffNote"
              rows={2}
              maxLength={500}
              className="field resize-y"
              defaultValue={CALLED_OFF_NOTE}
            />
          </label>
          <ConfirmButton
            confirm={`Call off ${eventDateShort(edition)}? Sign-ups stop and everyone sees the note. Guests aren't emailed, so post on Instagram too.`}
            className="btn bg-red px-5 py-2.5 text-sm text-cream hover:bg-rust"
          >
            Call it off
          </ConfirmButton>
        </form>
      )}
      {registrations === 0 &&
        !ended &&
        button("draft", "Unpublish", "Hide this date from the website again?")}
    </div>
  );
}
