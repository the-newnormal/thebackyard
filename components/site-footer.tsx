import Link from "next/link";
import { brand } from "@/content/copy";
import { event } from "@/content/event";
import { eventDateLong, eventTimeRange } from "@/lib/format";
import { Starburst } from "./shapes";

export function SiteFooter() {
  const { email, instagram } = event.contact;
  return (
    <footer className="relative overflow-hidden bg-forest-deep text-cream">
      <Starburst
        variant={1}
        color="var(--color-orange)"
        className="absolute -right-10 -bottom-12 w-40 opacity-90 sm:w-56"
      />
      <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr]">
        <div>
          <p className="font-display text-5xl text-lime sm:text-6xl">BACKYARD</p>
          <p className="mt-3 font-serif text-2xl italic text-cream/90">{brand.line}</p>
        </div>
        <div className="space-y-2 text-cream/85">
          <p className="font-heading text-lg text-cream">{event.name}</p>
          <p>
            {eventDateLong()} · {eventTimeRange()}
          </p>
          <p>
            {event.venue.name}, {event.venue.level}
            <br />
            {event.venue.address}
          </p>
          {(email || instagram) && (
            <p className="flex flex-wrap gap-x-4 pt-2">
              {email && (
                <a className="underline underline-offset-4 hover:text-lime" href={`mailto:${email}`}>
                  {email}
                </a>
              )}
              {instagram && (
                <a
                  className="underline underline-offset-4 hover:text-lime"
                  href={`https://instagram.com/${instagram}`}
                >
                  @{instagram}
                </a>
              )}
            </p>
          )}
        </div>
      </div>
      <div className="relative border-t border-cream/15">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-sm text-cream/60 sm:px-6">
          <p>Hosted by {event.organiser}</p>
          <Link href="/register" className="hover:text-lime">
            Save your spot →
          </Link>
        </div>
      </div>
    </footer>
  );
}
