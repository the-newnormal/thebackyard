import Image from "next/image";
import Link from "next/link";
import { event } from "@/content/event";
import { googleCalendarUrl } from "@/lib/calendar";
import { eventDateLong, eventTimeRange } from "@/lib/format";
import { siteUrl } from "@/lib/site";
import poster from "@/public/poster.webp";

function Row({
  label,
  color,
  children,
}: {
  label: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1 border-t-2 border-dashed border-forest/20 py-5 sm:grid-cols-[8rem_1fr] sm:gap-6">
      <dt className={`font-heading text-sm tracking-widest uppercase ${color}`}>{label}</dt>
      <dd className="text-lg leading-snug text-ink">{children}</dd>
    </div>
  );
}

export function Details() {
  return (
    <section id="details" className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
      <div className="grid items-center gap-14 md:grid-cols-[0.9fr_1.1fr] md:gap-20">
        <div className="relative mx-auto w-full max-w-sm -rotate-2 md:max-w-none">
          <span className="tape -top-3 left-6 -rotate-6" aria-hidden="true" />
          <span className="tape -top-3 right-6 rotate-6" aria-hidden="true" />
          <Image
            src={poster}
            alt={`Backyard community BBQ poster: ${event.tagline.join(", ")}. ${eventDateLong()}, ${eventTimeRange()}, ${event.venue.name}.`}
            className="w-full rounded-sm shadow-[0_18px_40px_-12px_rgb(31_64_41/0.45)]"
            sizes="(min-width: 768px) 40vw, 90vw"
            placeholder="blur"
          />
        </div>

        <div>
          <h2 className="font-brush text-7xl leading-none text-forest sm:text-8xl">the night</h2>
          <p className="mt-4 max-w-md font-serif text-2xl leading-snug text-muted italic">
            Food on the grill, chairs out, good people. Pull one up.
          </p>

          <dl className="mt-8 border-b-2 border-dashed border-forest/20">
            <Row label="When" color="text-orange-ink">
              <strong className="font-semibold">{eventDateLong()}</strong>
              <br />
              {eventTimeRange()}
              <a
                href={googleCalendarUrl(siteUrl())}
                target="_blank"
                rel="noreferrer"
                className="mt-2 block text-base font-semibold text-forest underline decoration-2 underline-offset-4 hover:text-vermilion"
              >
                Add to calendar
              </a>
            </Row>
            <Row label="Where" color="text-red">
              <strong className="font-semibold">
                {event.venue.name}, {event.venue.level}
              </strong>
              <br />
              {event.venue.address}
              <br />
              <span className="text-muted">{event.venue.directions}</span>
              <a
                href={event.venue.mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 block text-base font-semibold text-forest underline decoration-2 underline-offset-4 hover:text-vermilion"
              >
                Open in Maps
              </a>
            </Row>
            <Row label="What" color="text-forest">
              {event.tagline.map((t) => t[0].toUpperCase() + t.slice(1)).join(", ")}. Come as
              you are — bring a friend or come solo.
            </Row>
            <Row label="Cost" color="text-vermilion">
              Free. Just register so we know how much food to prep.
            </Row>
          </dl>

          <Link href="/register" className="btn btn-primary mt-8 px-7 py-4 text-lg">
            Register for free <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
