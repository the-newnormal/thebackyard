import Link from "next/link";
import { event } from "@/content/event";
import { eventDayMonth, eventTimeRange, eventWeekdayShort } from "@/lib/format";
import { Splat, Starburst } from "../shapes";

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden">
      <Starburst className="absolute -top-16 -left-20 -z-10 w-56 -rotate-12 sm:w-80" />
      <Starburst
        variant={2}
        className="absolute -right-16 -bottom-10 -z-10 w-48 rotate-6 sm:w-72"
      />

      <div className="mx-auto flex min-h-[calc(100svh-4rem)] max-w-6xl flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
        <p className="relative z-10 font-serif text-xl italic text-forest sm:text-2xl">
          {event.tagline.join(" | ")}
        </p>

        <div className="relative my-8 w-full sm:my-12">
          <Splat
            id="hero-splat"
            className="absolute -inset-x-[25%] -inset-y-[6%] -z-10 h-[112%] w-[150%] max-w-none sm:-inset-x-[16%] sm:w-[132%]"
          />
          <h1 className="relative py-16 sm:py-24">
            <span className="block font-serif text-[clamp(1.6rem,5.4vw,4.2rem)] leading-none text-lime italic">
              we invite you to our
            </span>
            <span className="-mt-[0.12em] block font-display text-[clamp(2.6rem,13vw,9.75rem)] text-lime drop-shadow-[0_3px_0_rgb(0_0_0/0.15)]">
              BACKYARD
            </span>
            <span className="mt-2 block pl-[28%] font-serif text-[clamp(1.4rem,4.2vw,3rem)] leading-none text-cream italic">
              {event.shortName.toLowerCase()}
            </span>
          </h1>
        </div>

        <p className="relative z-10 font-condensed text-2xl leading-tight text-forest sm:text-3xl">
          <span className="block sm:inline">
            {eventDayMonth()} ({eventWeekdayShort()}) · {eventTimeRange()}
          </span>
          <span className="hidden sm:inline"> · </span>
          <span className="block sm:inline">
            {event.venue.name} @ L1
          </span>
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/register" className="btn btn-primary px-7 py-4 text-lg">
            Save my spot <span aria-hidden="true">→</span>
          </Link>
          <Link href="#why" className="btn btn-outline px-6 py-4 text-lg text-forest">
            Why Backyard?
          </Link>
        </div>
      </div>
    </section>
  );
}
