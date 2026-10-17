import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { cache, Suspense } from "react";
import { PosterCard } from "@/components/home/poster-card";
import { RegistrationForm } from "@/components/registration-form";
import { Starburst } from "@/components/shapes";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { series } from "@/content/series";
import {
  editionState,
  featured,
  isRegistrationOpen,
  nextOpening,
  registrable,
} from "@/lib/editions/select";
import type { Edition } from "@/lib/editions/types";
import {
  eventDateLong,
  eventDateShort,
  eventTimeRange,
  formatMoment,
} from "@/lib/format";
import {
  getAvailability,
  getStore,
  isStoreConfigured,
  type Availability,
} from "@/lib/registrations";

export const metadata: Metadata = {
  title: "Register",
  description: "Save your spot at Backyard, a free community BBQ in Singapore every month.",
};

export default function RegisterPage({ searchParams }: PageProps<"/register">) {
  return (
    <>
      <SiteHeader cta={false} />
      <main className="relative isolate flex-1 overflow-hidden">
        <Starburst className="absolute -top-20 -right-24 -z-10 w-44 rotate-12 sm:-top-14 sm:-right-16 sm:w-64" />
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <p className="font-serif text-2xl text-forest italic">{series.tagline.join(" | ")}</p>
            <h1 className="mt-2 font-brush text-7xl leading-[0.9] text-forest sm:text-8xl">
              pull up a chair
            </h1>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-ink">
              Registration is free. It just helps us prep enough food and know who’s coming.
              Takes about a minute.
            </p>
            <Suspense fallback={<CardSkeleton />}>
              <EditionCard searchParams={searchParams} />
            </Suspense>
          </aside>

          <section
            aria-label="Registration form"
            className="rounded-3xl border-2 border-forest/15 bg-card/90 p-6 shadow-[0_24px_60px_-30px_rgb(31_64_41/0.45)] sm:p-10"
          >
            <Suspense fallback={<FormSkeleton />}>
              <RegistrationGate searchParams={searchParams} />
            </Suspense>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

type Target =
  | { kind: "unavailable" }
  | { kind: "error" }
  | { kind: "open"; edition: Edition; availability: Exclude<Availability, { state: "closed" }> }
  | {
      kind: "not-open";
      /** The edition asked for, or the one coming up. */
      edition: Edition | null;
      /** Another edition people can sign up for instead. */
      alternative: Edition | null;
      /** The next edition whose sign-ups open later. */
      opening: Edition | null;
      now: Date;
    };

/**
 * Which edition this visit registers for. One uncached read per request,
 * shared by the card and the form, so the two always agree.
 */
const resolveTarget = cache(async (requested: string): Promise<Target> => {
  if (!isStoreConfigured()) return { kind: "unavailable" };
  try {
    const editions = await getStore().listEditions();
    const now = new Date();
    const open = registrable(editions, now);
    const asked = requested
      ? editions.find((e) => e.slug === requested && e.status !== "draft")
      : undefined;
    const edition = asked ?? open[0];
    if (edition && isRegistrationOpen(edition, now)) {
      const availability = await getAvailability(edition, now);
      if (availability.state !== "closed") return { kind: "open", edition, availability };
    }
    return {
      kind: "not-open",
      edition: asked ?? featured(editions, now),
      alternative: open.find((e) => e.slug !== asked?.slug) ?? null,
      opening: nextOpening(editions, now),
      now,
    };
  } catch (error) {
    console.error("Couldn't load registration", error);
    return { kind: "error" };
  }
});

async function target(searchParams: PageProps<"/register">["searchParams"]) {
  await connection();
  const { edition } = await searchParams;
  return resolveTarget(typeof edition === "string" ? edition : "");
}

async function EditionCard({ searchParams }: Pick<PageProps<"/register">, "searchParams">) {
  const result = await target(searchParams);
  const edition =
    result.kind === "open"
      ? result.edition
      : result.kind === "not-open"
        ? (result.edition ?? result.opening)
        : null;
  if (!edition) return null;
  const { venue } = edition;

  return (
    <div className="mt-8 flex gap-5 rounded-2xl border-2 border-forest bg-card p-4 shadow-[6px_6px_0_var(--color-forest)]">
      {edition.poster ? (
        <Image
          src={edition.poster.src}
          width={edition.poster.width}
          height={edition.poster.height}
          alt=""
          className="w-24 shrink-0 -rotate-2 self-start rounded-sm bg-forest shadow-md sm:w-28"
          sizes="112px"
        />
      ) : (
        <PosterCard
          edition={edition}
          compact
          className="w-24 shrink-0 -rotate-2 self-start rounded-sm shadow-md sm:w-28"
        />
      )}
      <dl className="space-y-2 text-[0.95rem] leading-snug">
        <div>
          <dt className="font-heading text-xs tracking-widest text-orange-ink uppercase">When</dt>
          <dd>
            {eventDateLong(edition)}
            <br />
            {eventTimeRange(edition)}
          </dd>
        </div>
        <div>
          <dt className="font-heading text-xs tracking-widest text-red uppercase">Where</dt>
          <dd>
            {venue.name}
            {venue.level && `, ${venue.level}`}
            <br />
            {venue.address}
          </dd>
        </div>
        {edition.notice && (
          <div>
            <dt className="font-heading text-xs tracking-widest text-forest uppercase">Note</dt>
            <dd>{edition.notice}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}

async function RegistrationGate({ searchParams }: Pick<PageProps<"/register">, "searchParams">) {
  const result = await target(searchParams);

  if (result.kind === "unavailable") {
    return (
      <Notice
        title="Registration opens soon"
        body="We’re putting the final touches on sign-ups. Check back shortly!"
      />
    );
  }
  if (result.kind === "error") {
    return (
      <Notice
        title="We couldn’t load registration"
        body="Something went wrong on our side. Please try again in a moment."
      />
    );
  }
  if (result.kind === "not-open") return <NotOpen {...result} />;

  const { edition, availability } = result;
  const waitlist = availability.state === "waitlist";
  return (
    <>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-3xl text-forest">
            {waitlist ? "Join the waitlist" : "Save your spot"}
          </h2>
          <p className="mt-1 font-semibold text-muted">for {eventDateLong(edition)}</p>
        </div>
        <StatusPill availability={availability} />
      </div>
      {waitlist && (
        <p className="-mt-4 mb-8 rounded-xl bg-mustard/30 px-4 py-3 text-ink">
          Every spot is taken or held for someone already waiting. Join the waitlist and we’ll
          let you know if a spot opens up.
        </p>
      )}
      {availability.state === "open" &&
        availability.spotsLeft !== null &&
        availability.spotsLeft <= edition.maxGuests && (
          <p className="-mt-4 mb-8 rounded-xl bg-mustard/30 px-4 py-3 text-ink">
            {availability.spotsLeft === 1
              ? "If you’re bringing friends, you’ll join the waitlist."
              : `Groups of more than ${availability.spotsLeft} will join the waitlist.`}
          </p>
        )}
      <RegistrationForm
        edition={edition.slug}
        maxGuests={edition.maxGuests}
        organiser={series.organiser}
        waitlist={waitlist}
      />
    </>
  );
}

function NotOpen({
  edition,
  alternative,
  opening,
  now,
}: Extract<Target, { kind: "not-open" }>) {
  const instead = alternative && {
    href: `/register?edition=${alternative.slug}`,
    label: `Register for ${eventDateShort(alternative)}`,
  };
  const opensLater =
    opening &&
    `Sign-ups for ${eventDateShort(opening)} open ${formatMoment(opening.registrationOpensAt!)}.`;

  if (!edition) {
    return (
      <Notice
        title="No date open right now"
        body={
          opensLater ??
          `Backyard happens every month. Follow @${series.contact.instagram} on Instagram to hear when the next date opens.`
        }
        action={instead}
      />
    );
  }

  const date = eventDateShort(edition);
  switch (editionState(edition, now)) {
    case "cancelled":
      return (
        <Notice
          title={`${date} is called off`}
          body={edition.notice ?? opensLater ?? "Sorry! Keep an eye out for the next Backyard."}
          action={instead}
        />
      );
    case "upcoming":
      return (
        <Notice
          title={`Registration opens ${formatMoment(edition.registrationOpensAt!)}`}
          body={`Sign-ups for ${eventDateLong(edition)} aren’t open yet. Come back then!`}
          action={instead}
        />
      );
    default:
      return (
        <Notice
          title={`Registration for ${date} has closed`}
          body={
            instead
              ? "Thanks for the love! The next one is open already."
              : (opensLater ?? "Thanks for the love! Keep an eye out for the next Backyard.")
          }
          action={instead}
        />
      );
  }
}

function Notice({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: { href: string; label: string } | null;
}) {
  return (
    <div className="py-10 text-center">
      <Starburst variant={1} color="var(--color-orange)" className="mx-auto w-20" scribble={false} />
      <h2 className="mt-6 font-heading text-3xl text-forest">{title}</h2>
      <p className="mx-auto mt-3 max-w-sm text-lg text-muted">{body}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {action && (
          <Link href={action.href} className="btn btn-primary">
            {action.label} <span aria-hidden="true">→</span>
          </Link>
        )}
        <Link href="/" className="btn btn-outline">
          Back to home
        </Link>
      </div>
    </div>
  );
}

function StatusPill({ availability }: { availability: Exclude<Availability, { state: "closed" }> }) {
  if (availability.state === "waitlist") {
    return (
      <span className="rounded-full bg-mustard px-3 py-1 text-sm font-bold text-forest-deep">
        Waitlist open
      </span>
    );
  }
  const few = availability.spotsLeft !== null && availability.spotsLeft <= 20;
  return (
    <span
      className={`rounded-full px-3 py-1 text-sm font-bold ${few ? "bg-red text-card" : "bg-lime text-forest-deep"}`}
    >
      {availability.spotsLeft === null
        ? "Registration open"
        : few
          ? `Only ${availability.spotsLeft} ${availability.spotsLeft === 1 ? "spot" : "spots"} left`
          : "Registration open"}
    </span>
  );
}

function CardSkeleton() {
  return <div className="mt-8 h-40 animate-pulse rounded-2xl bg-forest/10" aria-hidden="true" />;
}

function FormSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading form" className="animate-pulse space-y-6">
      <div className="h-9 w-56 rounded-lg bg-forest/10" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="space-y-2">
          <div className="h-4 w-32 rounded bg-forest/10" />
          <div className="h-12 rounded-xl bg-forest/10" />
        </div>
      ))}
      <div className="h-14 rounded-full bg-forest/15" />
    </div>
  );
}
