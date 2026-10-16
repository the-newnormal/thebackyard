import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ConfirmButton } from "@/components/confirm-button";
import { Splat, Starburst } from "@/components/shapes";
import { SiteHeader } from "@/components/site-header";
import { event } from "@/content/event";
import { googleCalendarUrl } from "@/lib/calendar";
import { eventDateLong, eventTimeRange, firstName } from "@/lib/format";
import { getStore, partySize, type Registration } from "@/lib/registrations";
import { isValidPassToken } from "@/lib/registrations/code";
import { siteUrl } from "@/lib/site";
import { releaseSpot } from "../actions";

export const metadata: Metadata = {
  title: "Your pass",
  robots: { index: false, follow: false },
};

export default function PassPage({ params, searchParams }: PageProps<"/pass/[token]">) {
  return (
    <>
      <SiteHeader cta={false} />
      <main className="relative isolate flex-1 overflow-hidden px-4 py-12 sm:py-16">
        <Starburst className="absolute top-10 -left-16 -z-10 w-44 -rotate-12 sm:w-60" />
        <Starburst
          variant={2}
          color="var(--color-orange)"
          scribble={false}
          className="absolute -right-10 bottom-10 -z-10 w-36 rotate-12 sm:w-48"
        />
        <Suspense fallback={<PassSkeleton />}>
          <Pass params={params} searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}

async function Pass({
  params,
  searchParams,
}: Pick<PageProps<"/pass/[token]">, "params" | "searchParams">) {
  const { token } = await params;
  if (!isValidPassToken(token)) notFound();
  const registration = await getStore().getByPassToken(token);
  if (!registration) notFound();
  const query = await searchParams;

  return (
    <div className="mx-auto max-w-xl">
      {query.new && registration.status !== "cancelled" && (
        <p className="mb-6 rounded-2xl bg-lime px-5 py-4 text-center font-semibold text-forest-deep">
          {registration.status === "waitlist"
            ? "You’re on the waitlist."
            : "You’re registered!"}{" "}
          Screenshot or bookmark this page — it’s your pass.
        </p>
      )}
      {query.existing && registration.status !== "cancelled" && (
        <p className="mb-6 rounded-2xl bg-mustard/50 px-5 py-4 text-center font-semibold text-forest-deep">
          You’re already registered, so we kept your original details. To change them,
          release this spot and register again.
        </p>
      )}
      <Ticket registration={registration} />
    </div>
  );
}

function Ticket({ registration }: { registration: Registration }) {
  const { status } = registration;
  const party = partySize(registration);
  const headline =
    status === "confirmed"
      ? `you’re in, ${firstName(registration.name).toLowerCase()}!`
      : status === "waitlist"
        ? "you’re on the waitlist"
        : "spot released";

  return (
    <article className="overflow-hidden rounded-3xl border-2 border-forest bg-card shadow-[10px_10px_0_var(--color-forest)]">
      <header className="relative isolate overflow-hidden bg-forest px-6 pt-10 pb-12 text-center">
        <Splat
          id="pass-splat"
          color="var(--color-forest-deep)"
          className="absolute -inset-x-[10%] -inset-y-[10%] -z-10 h-[120%] w-[120%] opacity-60"
        />
        <p className="font-serif text-xl text-lime italic">{event.tagline.join(" | ")}</p>
        <p className="mt-2 font-display text-[clamp(2.25rem,11vw,4.5rem)] text-lime">BACKYARD</p>
        <p className="mt-1 font-serif text-2xl text-cream italic">
          {event.shortName.toLowerCase()}
        </p>
      </header>

      <div className="px-6 pt-8 pb-6 text-center sm:px-10">
        <h1
          className={`font-brush text-5xl leading-none sm:text-6xl ${status === "cancelled" ? "text-muted" : "text-forest"}`}
        >
          {headline}
        </h1>
        {status === "waitlist" && (
          <p className="mx-auto mt-3 max-w-sm text-muted">
            We’re at capacity for now. If a spot opens up, we’ll be in touch.
          </p>
        )}
        {status === "cancelled" && (
          <p className="mx-auto mt-3 max-w-sm text-muted">
            This registration was cancelled. Changed your mind?{" "}
            <Link href="/register" className="font-semibold text-forest underline underline-offset-4">
              Register again
            </Link>
            .
          </p>
        )}
      </div>

      {/* Perforation */}
      <div className="relative flex items-center" aria-hidden="true">
        <span className="absolute -left-4 size-8 rounded-full border-2 border-forest bg-paper" />
        <span className="mx-6 w-full border-t-2 border-dashed border-forest/30" />
        <span className="absolute -right-4 size-8 rounded-full border-2 border-forest bg-paper" />
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-5 px-6 py-8 sm:px-10">
        <Item label="Name">{registration.name}</Item>
        <Item label="Party">
          {party} {party === 1 ? "person" : "people"}
        </Item>
        <Item label="When">
          {eventDateLong()}
          <br />
          {eventTimeRange()}
        </Item>
        <Item label="Where">
          {event.venue.name}, {event.venue.level}
          <br />
          <span className="text-muted">{event.venue.address}</span>
        </Item>
        <div className="col-span-2 rounded-2xl bg-cream px-5 py-4 text-center">
          <dt className="font-heading text-xs tracking-widest text-orange-ink uppercase">
            Check-in code
          </dt>
          <dd className="mt-1 font-mono text-4xl font-bold tracking-[0.3em] text-forest">
            {registration.code}
          </dd>
        </div>
      </dl>

      {status !== "cancelled" && (
        <div className="space-y-4 border-t-2 border-forest/10 px-6 py-6 sm:px-10">
          <div className="flex flex-wrap justify-center gap-2">
            <a
              href={googleCalendarUrl(siteUrl())}
              target="_blank"
              rel="noreferrer"
              className="btn btn-primary px-5 py-3 text-sm"
            >
              Add to Google Calendar
            </a>
            <a href="/event.ics" className="btn btn-outline px-5 py-3 text-sm text-forest">
              Apple / Outlook (.ics)
            </a>
            <a
              href={event.venue.mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="btn btn-outline px-5 py-3 text-sm text-forest"
            >
              Directions
            </a>
          </div>
          <form action={releaseSpot.bind(null, registration.passToken)} className="text-center">
            <ConfirmButton
              confirm="Release your spot? Someone else will be able to take it."
              pendingLabel="Releasing…"
              className="text-sm font-semibold text-muted underline underline-offset-4 hover:text-red"
            >
              Plans changed? Release my spot
            </ConfirmButton>
          </form>
        </div>
      )}
    </article>
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-heading text-xs tracking-widest text-orange-ink uppercase">{label}</dt>
      <dd className="mt-1 leading-snug font-semibold text-ink">{children}</dd>
    </div>
  );
}

function PassSkeleton() {
  return (
    <div className="mx-auto max-w-xl animate-pulse" aria-busy="true" aria-label="Loading your pass">
      <div className="h-[34rem] rounded-3xl border-2 border-forest/20 bg-card" />
    </div>
  );
}
