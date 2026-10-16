import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { RegistrationForm } from "@/components/registration-form";
import { Starburst } from "@/components/shapes";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { event } from "@/content/event";
import { eventDateLong, eventTimeRange } from "@/lib/format";
import { getAvailability, isStoreConfigured } from "@/lib/registrations";
import poster from "@/public/poster.webp";

export const metadata: Metadata = {
  title: "Register",
  description: `Save your spot at the ${event.name} — ${eventDateLong()}, ${eventTimeRange()} at ${event.venue.name}.`,
};

export default function RegisterPage() {
  return (
    <>
      <SiteHeader cta={false} />
      <main className="relative isolate flex-1 overflow-hidden">
        <Starburst className="absolute -top-20 -right-24 -z-10 w-44 rotate-12 sm:-top-14 sm:-right-16 sm:w-64" />
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <p className="font-serif text-2xl text-forest italic">{event.tagline.join(" | ")}</p>
            <h1 className="mt-2 font-brush text-7xl leading-[0.9] text-forest sm:text-8xl">
              pull up a chair
            </h1>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-ink">
              Registration is free. It just helps us prep enough food and know who’s coming.
              Takes about a minute.
            </p>

            <div className="mt-8 flex gap-5 rounded-2xl border-2 border-forest bg-card p-4 shadow-[6px_6px_0_var(--color-forest)]">
              <Image
                src={poster}
                alt=""
                className="w-24 shrink-0 -rotate-2 rounded-sm shadow-md sm:w-28"
                sizes="112px"
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
          </aside>

          <section
            aria-label="Registration form"
            className="rounded-3xl border-2 border-forest/15 bg-card/90 p-6 shadow-[0_24px_60px_-30px_rgb(31_64_41/0.45)] sm:p-10"
          >
            <Suspense fallback={<FormSkeleton />}>
              <RegistrationGate />
            </Suspense>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

async function RegistrationGate() {
  await connection();

  if (!isStoreConfigured()) {
    return (
      <Notice
        title="Registration opens soon"
        body="We’re putting the final touches on sign-ups. Check back shortly!"
      />
    );
  }

  let availability;
  try {
    availability = await getAvailability(new Date());
  } catch (error) {
    console.error(error);
    // Still show the form; the action reports what went wrong on submit.
    availability = { state: "open", spotsLeft: null } as const;
  }

  if (availability.state === "closed") {
    return (
      <Notice
        title="Registration has closed"
        body="Thanks for the love! Keep an eye out for the next Backyard."
      />
    );
  }

  const waitlist = availability.state === "waitlist";
  return (
    <>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-3xl text-forest">
          {waitlist ? "Join the waitlist" : "Save your spot"}
        </h2>
        <StatusPill availability={availability} />
      </div>
      {waitlist && (
        <p className="-mt-4 mb-8 rounded-xl bg-mustard/30 px-4 py-3 text-ink">
          Every spot is taken or held for someone already waiting. Join the waitlist and we’ll
          let you know if a spot opens up.
        </p>
      )}
      <RegistrationForm waitlist={waitlist} />
    </>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="py-10 text-center">
      <Starburst variant={1} color="var(--color-orange)" className="mx-auto w-20" scribble={false} />
      <h2 className="mt-6 font-heading text-3xl text-forest">{title}</h2>
      <p className="mx-auto mt-3 max-w-sm text-lg text-muted">{body}</p>
      <Link href="/" className="btn btn-outline mt-8 text-forest">
        Back to home
      </Link>
    </div>
  );
}

function StatusPill({
  availability,
}: {
  availability: { state: "open"; spotsLeft: number | null } | { state: "waitlist" };
}) {
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
