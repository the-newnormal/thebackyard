import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { RegistrationFlow } from "@/components/registration/registration-flow";
import { Starburst } from "@/components/shapes";
import { event } from "@/content/event";
import { eventDateLong, eventTimeRange } from "@/lib/format";
import { isPhoneVerificationEnabled } from "@/lib/phone-verification";
import { getAvailability, isStoreConfigured, type Availability } from "@/lib/registrations";
import poster from "@/public/poster.webp";

export const metadata: Metadata = {
  title: "Register",
  description: `Save your spot at the ${event.name} — ${eventDateLong()}, ${eventTimeRange()} at ${event.venue.name}.`,
};

// A page of its own: one question per screen, without the site header and
// footer. The welcome screen renders here; the questions run in the browser.
export default function RegisterPage() {
  return (
    <main className="flex flex-1 flex-col">
      <Suspense
        fallback={
          <div className="relative isolate flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-4 py-14 text-center">
            <Welcome />
            <div className="mt-9 h-[3.75rem] w-52 animate-pulse rounded-full bg-forest/15" />
          </div>
        }
      >
        <RegistrationGate />
      </Suspense>
    </main>
  );
}

async function RegistrationGate() {
  await connection();

  if (!isStoreConfigured()) {
    return (
      <Notice
        title="registration opens soon"
        body="We’re putting the final touches on sign-ups. Check back shortly!"
      />
    );
  }

  let availability: Availability;
  try {
    availability = await getAvailability(new Date());
  } catch (error) {
    console.error(error);
    // Still show the form; the action reports what went wrong on submit.
    availability = { state: "open", spotsLeft: null };
  }

  if (availability.state === "closed") {
    return (
      <Notice
        title="registration has closed"
        body="Thanks for the love! Keep an eye out for the next Backyard."
      />
    );
  }

  return (
    <RegistrationFlow
      intro={<Welcome availability={availability} />}
      waitlist={availability.state === "waitlist"}
      verifyPhone={isPhoneVerificationEnabled()}
    />
  );
}

type OpenAvailability = Exclude<Availability, { state: "closed" }>;

function Welcome({ availability }: { availability?: OpenAvailability }) {
  return (
    <>
      <Starburst className="absolute -top-16 -right-20 -z-10 w-44 rotate-12 sm:-top-10 sm:-right-10 sm:w-64" />
      <Starburst
        variant={2}
        color="var(--color-orange)"
        scribble={false}
        className="absolute -bottom-12 -left-16 -z-10 w-40 -rotate-12 sm:w-56"
      />

      <Link href="/" className="font-display text-3xl text-forest" aria-label="Backyard home">
        BACKYARD
      </Link>
      <p className="mt-6 font-serif text-xl text-forest italic sm:text-2xl">
        {event.tagline.join(" | ")}
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

      <div className="mx-auto mt-8 flex max-w-md gap-5 rounded-2xl border-2 border-forest bg-card p-4 text-left shadow-[6px_6px_0_var(--color-forest)]">
        <Image
          src={poster}
          alt=""
          className="w-20 shrink-0 -rotate-2 rounded-sm shadow-md sm:w-24"
          sizes="96px"
          placeholder="blur"
        />
        <dl className="space-y-2 text-[0.95rem] leading-snug">
          <div>
            <dt className="font-heading text-xs tracking-widest text-orange-ink uppercase">When</dt>
            <dd>
              {eventDateLong()}
              <br />
              {eventTimeRange()}
            </dd>
          </div>
          <div>
            <dt className="font-heading text-xs tracking-widest text-red uppercase">Where</dt>
            <dd>
              {event.venue.name}, {event.venue.level}
              <br />
              {event.venue.address}
            </dd>
          </div>
        </dl>
      </div>
    </>
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

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="relative isolate flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-4 py-14 text-center">
      <Starburst className="absolute -top-16 -right-20 -z-10 w-44 rotate-12 sm:w-64" />
      <Link href="/" className="font-display text-3xl text-forest" aria-label="Backyard home">
        BACKYARD
      </Link>
      <h1 className="mt-6 font-brush text-[clamp(3.5rem,13vw,6rem)] leading-[0.9] text-forest">
        {title}
      </h1>
      <p className="mx-auto mt-4 max-w-sm text-lg text-muted">{body}</p>
      <Link href="/" className="btn btn-outline mt-8">
        Back to home
      </Link>
    </div>
  );
}
