import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ConfirmButton } from "@/components/confirm-button";
import { ClearRegistrationProgress } from "@/components/registration/progress";
import { Splat, Starburst } from "@/components/shapes";
import { SiteHeader } from "@/components/site-header";
import { series } from "@/content/series";
import { googleCalendarUrl } from "@/lib/calendar";
import {
  editionState,
  isRegistrationOpen,
  nextOpening,
  registrable,
  type EditionState,
} from "@/lib/editions/select";
import type { Edition } from "@/lib/editions/types";
import {
  eventDateLong,
  eventDateShort,
  eventTimeRange,
  firstName,
  formatMoment,
  venueMapsUrl,
} from "@/lib/format";
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
  await connection();
  const { token } = await params;
  if (!isValidPassToken(token)) notFound();
  const store = getStore();
  const registration = await store.getByPassToken(token);
  if (!registration) notFound();
  const query = await searchParams;

  // Always the pass's own date, never whichever one the homepage shows now.
  const editions = await store.listEditions();
  const now = new Date();
  const edition = editions.find((e) => e.slug === registration.eventSlug) ?? null;
  const state = edition && editionState(edition, now);
  const open = registrable(editions, now);
  const next =
    edition && isRegistrationOpen(edition, now)
      ? edition
      : (open.find((e) => e.slug !== registration.eventSlug) ?? null);
  const upcoming = nextOpening(editions, now);

  return (
    <div className="mx-auto max-w-xl">
      {(query.new || query.existing) && (
        <ClearRegistrationProgress edition={registration.eventSlug} />
      )}
      {query.new && registration.status !== "cancelled" && (
        <p className="mb-6 rounded-2xl bg-lime px-5 py-4 text-center font-semibold text-forest-deep">
          {registration.status === "waitlist"
            ? "You’re on the waitlist. Bookmark this page — it’ll show if you get a spot."
            : "You’re registered! Screenshot or bookmark this page — it’s your pass."}
        </p>
      )}
      {query.existing && registration.status !== "cancelled" && (
        <p className="mb-6 rounded-2xl bg-mustard/50 px-5 py-4 text-center font-semibold text-forest-deep">
          You’re already registered, so we kept your original details. To change them,
          release this spot and register again.
        </p>
      )}
      <Ticket
        registration={registration}
        edition={edition}
        state={state}
        next={next}
        upcoming={upcoming}
      />
    </div>
  );
}

function Ticket({
  registration,
  edition,
  state,
  next,
  upcoming,
}: {
  registration: Registration;
  /** null only if the edition row is missing; the pass still shows the code. */
  edition: Edition | null;
  state: EditionState | null;
  /** Where "register" links should go: this edition if still open, else the next open one. */
  next: Edition | null;
  /** The next date whose sign-ups open later (maybe this one). */
  upcoming: Edition | null;
}) {
  const { status } = registration;
  const party = partySize(registration);
  const calledOff = state === "cancelled";
  const over = state === "past";
  const active = status !== "cancelled" && !calledOff && !over;
  const name = firstName(registration.name).toLowerCase();
  const headline = calledOff
    ? "this one’s called off"
    : status === "cancelled"
      ? "spot released"
      : over
        ? registration.checkedInAt
          ? `thanks for coming, ${name}!`
          : "hope to see you next time"
        : status === "confirmed"
          ? `you’re in, ${name}!`
          : "you’re on the waitlist";

  const nextLink = next && (
    <Link
      href={`/register?edition=${next.slug}`}
      className="font-semibold text-forest underline underline-offset-4"
    >
      {next.slug === edition?.slug ? "Register again" : `Register for ${eventDateShort(next)}`}
    </Link>
  );
  const opensLater =
    upcoming &&
    `Sign-ups for ${eventDateShort(upcoming)} open ${formatMoment(upcoming.registrationOpensAt!)}.`;

  return (
    <article className="overflow-hidden rounded-3xl border-2 border-forest bg-card shadow-[10px_10px_0_var(--color-forest)]">
      <header className="relative isolate overflow-hidden bg-forest px-6 pt-10 pb-12 text-center">
        <Splat
          id="pass-splat"
          color="var(--color-forest-deep)"
          className="absolute -inset-x-[10%] -inset-y-[10%] -z-10 h-[120%] w-[120%] opacity-60"
        />
        <p className="font-serif text-xl text-lime italic">{series.tagline.join(" | ")}</p>
        <p className="mt-2 font-display text-[clamp(2.25rem,11vw,4.5rem)] text-lime">BACKYARD</p>
        <p className="mt-1 font-serif text-2xl text-cream italic">
          {series.shortName.toLowerCase()}
        </p>
      </header>

      <div className="px-6 pt-8 pb-6 text-center sm:px-10">
        <h1
          className={`font-brush text-5xl leading-none [overflow-wrap:anywhere] sm:text-6xl ${active || (over && status !== "cancelled") ? "text-forest" : "text-muted"}`}
        >
          {headline}
        </h1>
        {calledOff && (
          <p className="mx-auto mt-3 max-w-sm text-muted">
            {edition?.calledOffNote ?? "Sorry about this one."}{" "}
            {nextLink ? <>The next one’s open: {nextLink}.</> : opensLater}
          </p>
        )}
        {!calledOff && edition?.notice && !over && (
          <p className="mx-auto mt-4 max-w-sm rounded-2xl bg-mustard/40 px-4 py-3 font-semibold text-forest-deep">
            {edition.notice}
          </p>
        )}
        {active && status === "waitlist" && (
          <p className="mx-auto mt-3 max-w-sm text-muted">
            We’re at capacity for now. If a spot opens up, we’ll be in touch.
          </p>
        )}
        {!calledOff && status === "cancelled" && (
          <p className="mx-auto mt-3 max-w-sm text-muted">
            {next && next.slug === edition?.slug ? (
              <>This registration was cancelled. Changed your mind? {nextLink}.</>
            ) : state === "upcoming" && edition?.registrationOpensAt ? (
              <>
                This registration was cancelled. Sign-ups for {eventDateShort(edition)} open{" "}
                {formatMoment(edition.registrationOpensAt)}.
              </>
            ) : (
              <>
                This registration was cancelled
                {edition && `, and sign-ups for ${eventDateShort(edition)} have closed`}.{" "}
                {nextLink ? (
                  <>Coming next time? {nextLink}.</>
                ) : (
                  (opensLater ?? "Keep an eye out for the next Backyard.")
                )}
              </>
            )}
          </p>
        )}
        {over && status !== "cancelled" && (
          <p className="mx-auto mt-3 max-w-sm text-muted">
            {nextLink ? (
              <>Backyard is back every month. {nextLink}.</>
            ) : opensLater ? (
              <>Backyard is back every month. {opensLater}</>
            ) : (
              <>
                Backyard is back every month. Follow{" "}
                <a
                  href={`https://instagram.com/${series.contact.instagram}`}
                  className="font-semibold text-forest underline underline-offset-4"
                >
                  @{series.contact.instagram}
                </a>{" "}
                for the next date.
              </>
            )}
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
        {/* Only sign-ups from before everyone registered individually have friends. */}
        {party > 1 ? (
          <>
            <Item label="Name">{registration.name}</Item>
            <Item label="Party">{party} people</Item>
          </>
        ) : (
          <Item label="Name" className="col-span-2">
            {registration.name}
          </Item>
        )}
        {edition && (
          <>
            <Item label="When">
              <span className={calledOff ? "line-through" : undefined}>
                {eventDateLong(edition)}
                <br />
                {eventTimeRange(edition)}
              </span>
            </Item>
            <Item label="Where">
              {edition.venue.name}
              {edition.venue.level && `, ${edition.venue.level}`}
              <br />
              <span className="text-muted">{edition.venue.address}</span>
            </Item>
          </>
        )}
        {!calledOff && (
          <div className="col-span-2 rounded-2xl bg-cream px-5 py-4 text-center">
            <dt className="font-heading text-xs tracking-widest text-orange-ink uppercase">
              Check-in code
            </dt>
            <dd
              className={`mt-1 font-mono text-4xl font-bold tracking-[0.3em] ${over ? "text-muted" : "text-forest"}`}
            >
              {registration.code}
            </dd>
          </div>
        )}
      </dl>

      {active && (
        <div className="space-y-4 border-t-2 border-forest/10 px-6 py-6 sm:px-10">
          {edition && (
            <div className="flex flex-wrap justify-center gap-2">
              <a
                href={googleCalendarUrl(edition, siteUrl())}
                target="_blank"
                rel="noreferrer"
                className="btn btn-primary px-5 py-3 text-sm"
              >
                Add to Google Calendar
              </a>
              <a
                href={`/event.ics?edition=${edition.slug}`}
                className="btn btn-outline px-5 py-3 text-sm"
              >
                Apple / Outlook (.ics)
              </a>
              <a
                href={venueMapsUrl(edition.venue)}
                target="_blank"
                rel="noreferrer"
                className="btn btn-outline px-5 py-3 text-sm"
              >
                Directions
              </a>
            </div>
          )}
          {/* Mid-event, a release would only confuse the check-in desk. */}
          {state !== "live" && (
            <form action={releaseSpot.bind(null, registration.passToken)} className="text-center">
              <ConfirmButton
                confirm="Release your spot? Someone else will be able to take it."
                pendingLabel="Releasing…"
                className="text-sm font-semibold text-muted underline underline-offset-4 hover:text-red"
              >
                Plans changed? Release my spot
              </ConfirmButton>
            </form>
          )}
        </div>
      )}
    </article>
  );
}

function Item({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <dt className="font-heading text-xs tracking-widest text-orange-ink uppercase">{label}</dt>
      <dd className="mt-1 leading-snug font-semibold text-ink [overflow-wrap:anywhere]">{children}</dd>
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
