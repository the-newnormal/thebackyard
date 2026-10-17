import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { PosterCard } from "@/components/home/poster-card";
import { RegistrationFlow } from "@/components/registration/registration-flow";
import { Starburst } from "@/components/shapes";
import { series } from "@/content/series";
import {
  editionState,
  featured,
  isRegistrationOpen,
  nextOpening,
  registrable,
} from "@/lib/editions/select";
import type { Edition } from "@/lib/editions/types";
import { eventDateLong, eventDateShort, eventTimeRange, formatMoment } from "@/lib/format";
import { isPhoneVerificationEnabled } from "@/lib/phone-verification";
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

const SCREEN =
  "relative isolate flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-4 py-14 text-center";

// A page of its own: one question per screen, without the site header and
// footer. The welcome screen renders here; the questions run in the browser.
export default function RegisterPage({ searchParams }: PageProps<"/register">) {
  return (
    <main className="flex flex-1 flex-col">
      <Suspense
        fallback={
          <div className={SCREEN}>
            <Welcome />
            <div className="mt-9 h-[3.75rem] w-52 animate-pulse rounded-full bg-forest/15" />
          </div>
        }
      >
        <RegistrationGate searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

type OpenAvailability = Exclude<Availability, { state: "closed" }>;

type Target =
  | { kind: "unavailable" }
  | { kind: "error" }
  | { kind: "open"; edition: Edition; availability: OpenAvailability }
  | {
      kind: "not-open";
      /** The edition asked for, or the one coming up. */
      edition: Edition | null;
      /** A ?edition= link to a date that doesn't exist (or isn't public). */
      unknown: boolean;
      /** Another edition people can sign up for instead. */
      alternative: Edition | null;
      /** The next edition whose sign-ups open later. */
      opening: Edition | null;
      now: Date;
    };

/** Which edition this visit registers for, from one uncached read. */
async function resolveTarget(requested: string): Promise<Target> {
  if (!isStoreConfigured()) return { kind: "unavailable" };
  try {
    const editions = await getStore().listEditions();
    const now = new Date();
    const open = registrable(editions, now);
    const asked = requested
      ? editions.find((e) => e.slug === requested && e.status !== "draft")
      : undefined;
    const edition = requested ? asked : open[0];
    if (edition && isRegistrationOpen(edition, now)) {
      const availability = await getAvailability(edition, now);
      if (availability.state !== "closed") return { kind: "open", edition, availability };
    }
    return {
      kind: "not-open",
      unknown: Boolean(requested) && !asked,
      edition: requested ? (asked ?? null) : featured(editions, now),
      alternative: open.find((e) => e.slug !== asked?.slug) ?? null,
      opening: nextOpening(editions, now),
      now,
    };
  } catch (error) {
    console.error("Couldn't load registration", error);
    return { kind: "error" };
  }
}

async function RegistrationGate({ searchParams }: Pick<PageProps<"/register">, "searchParams">) {
  await connection();
  const { edition: requested } = await searchParams;
  const result = await resolveTarget(typeof requested === "string" ? requested : "");

  if (result.kind === "unavailable") {
    return (
      <Notice
        title="registration opens soon"
        body="We’re putting the final touches on sign-ups. Check back shortly!"
      />
    );
  }
  if (result.kind === "error") {
    return (
      <Notice
        title="we couldn’t load registration"
        body="Something went wrong on our side. Please try again in a moment."
      />
    );
  }
  if (result.kind === "not-open") return <NotOpen {...result} />;

  const { edition, availability } = result;
  return (
    <RegistrationFlow
      edition={edition.slug}
      date={eventDateShort(edition)}
      intro={<Welcome edition={edition} availability={availability} />}
      waitlist={availability.state === "waitlist"}
      verifyPhone={isPhoneVerificationEnabled()}
    />
  );
}

function Backdrop() {
  return (
    <>
      <Starburst className="absolute -top-16 -right-20 -z-10 w-44 rotate-12 sm:-top-10 sm:-right-10 sm:w-64" />
      <Starburst
        variant={2}
        color="var(--color-orange)"
        scribble={false}
        className="absolute -bottom-12 -left-16 -z-10 w-40 -rotate-12 sm:w-56"
      />
    </>
  );
}

function Welcome({
  edition,
  availability,
}: {
  edition?: Edition;
  availability?: OpenAvailability;
}) {
  return (
    <>
      <Backdrop />
      <Link href="/" className="font-display text-3xl text-forest" aria-label="Backyard home">
        BACKYARD
      </Link>
      <p className="mt-6 font-serif text-xl text-forest italic sm:text-2xl">
        {series.tagline.join(" | ")}
      </p>
      <h1 className="mt-2 font-brush text-[clamp(4rem,17vw,7.5rem)] leading-[0.9] text-forest">
        pull up a chair
      </h1>
      {availability && <StatusPill availability={availability} />}
      <p className="mx-auto mt-5 max-w-md text-lg leading-relaxed text-ink">
        Registration is free. It just helps us prep enough food and know who’s coming.
      </p>
      {availability?.state === "waitlist" && (
        <p className="mx-auto mt-4 max-w-md rounded-xl bg-mustard/30 px-4 py-3 text-ink">
          Every spot is taken or held for someone already waiting. Join the waitlist and we’ll
          let you know if a spot opens up.
        </p>
      )}
      {edition && <EditionCard edition={edition} />}
    </>
  );
}

/** The date being registered for: poster (or a date card), when, where and any note. */
function EditionCard({ edition }: { edition: Edition }) {
  const { venue } = edition;
  return (
    <div className="mx-auto mt-8 flex w-full max-w-md gap-5 rounded-2xl border-2 border-forest bg-card p-4 text-left shadow-[6px_6px_0_var(--color-forest)]">
      {edition.poster ? (
        <Image
          src={edition.poster.src}
          width={edition.poster.width}
          height={edition.poster.height}
          alt=""
          className="w-20 shrink-0 -rotate-2 self-start rounded-sm bg-forest shadow-md sm:w-24"
          sizes="96px"
        />
      ) : (
        <PosterCard
          edition={edition}
          compact
          className="w-20 shrink-0 -rotate-2 self-start rounded-sm shadow-md sm:w-24"
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
        {edition.notice && edition.status !== "cancelled" && (
          <div>
            <dt className="font-heading text-xs tracking-widest text-forest uppercase">Note</dt>
            <dd>{edition.notice}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}

function StatusPill({ availability }: { availability: OpenAvailability }) {
  if (availability.state === "waitlist") {
    return (
      <span className="mt-7 rounded-full bg-mustard px-3 py-1 text-sm font-bold text-forest-deep">
        Waitlist open
      </span>
    );
  }
  const few = availability.spotsLeft !== null && availability.spotsLeft <= 20;
  return (
    <span
      className={`mt-7 rounded-full px-3 py-1 text-sm font-bold ${few ? "bg-red text-card" : "bg-lime text-forest-deep"}`}
    >
      {few
        ? `Only ${availability.spotsLeft} ${availability.spotsLeft === 1 ? "spot" : "spots"} left`
        : "Registration open"}
    </span>
  );
}

function NotOpen({
  edition,
  unknown,
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

  if (unknown) {
    return (
      <Notice
        title="that date isn’t taking sign-ups"
        body={
          alternative
            ? `Sign-ups for ${eventDateLong(alternative)} are open.`
            : (opensLater ??
              `Follow @${series.contact.instagram} on Instagram to hear when the next date opens.`)
        }
        action={instead}
        card={alternative ?? opening}
      />
    );
  }

  if (!edition) {
    return (
      <Notice
        title="no date open right now"
        body={
          opensLater ??
          `Backyard happens every month. Follow @${series.contact.instagram} on Instagram to hear when the next date opens.`
        }
        action={instead}
        card={opening}
      />
    );
  }

  const date = eventDateShort(edition);
  switch (editionState(edition, now)) {
    case "cancelled":
      return (
        <Notice
          title={`${date} is called off`}
          body={
            [edition.calledOffNote, opensLater].filter(Boolean).join(" ") ||
            "Sorry! Keep an eye out for the next Backyard."
          }
          action={instead}
        />
      );
    case "upcoming":
      return (
        <Notice
          title={`sign-ups open ${formatMoment(edition.registrationOpensAt!)}`}
          body={`Sign-ups for ${eventDateLong(edition)} aren’t open yet. Come back then!`}
          action={instead}
          card={edition}
        />
      );
    default:
      return (
        <Notice
          title="registration has closed"
          body={
            instead
              ? `Sign-ups for ${eventDateLong(edition)} have closed, but the next one is open already.`
              : `Sign-ups for ${eventDateLong(edition)} have closed. ${opensLater ?? "Thanks for the love! Keep an eye out for the next Backyard."}`
          }
          action={instead}
          card={edition}
        />
      );
  }
}

function Notice({
  title,
  body,
  action,
  card,
}: {
  title: string;
  body: string;
  action?: { href: string; label: string } | null;
  /** The date the message is about. */
  card?: Edition | null;
}) {
  return (
    <div className={SCREEN}>
      <Backdrop />
      <Link href="/" className="font-display text-3xl text-forest" aria-label="Backyard home">
        BACKYARD
      </Link>
      <h1 className="mt-6 max-w-2xl font-brush text-[clamp(3rem,11vw,5.5rem)] leading-[0.9] text-forest">
        {title}
      </h1>
      <p className="mx-auto mt-4 max-w-md text-lg text-muted">{body}</p>
      {card && <EditionCard edition={card} />}
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
