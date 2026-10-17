import Image from "next/image";
import Link from "next/link";
import { series } from "@/content/series";
import { googleCalendarUrl } from "@/lib/calendar";
import type { Edition } from "@/lib/editions/types";
import { eventDateLong, eventDateShort, eventTimeRange, venueMapsUrl } from "@/lib/format";
import { siteUrl } from "@/lib/site";
import { PosterCard } from "./poster-card";

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

const linkClass =
  "mt-2 block text-base font-semibold text-forest underline decoration-2 underline-offset-4 hover:text-vermilion";

function posterAlt(edition: Edition): string {
  const { venue } = edition;
  return [
    `Backyard community BBQ poster: ${series.tagline.join(", ")}.`,
    `${eventDateLong(edition)}, ${eventTimeRange(edition)}, ${venue.name}.`,
    edition.notice ?? "Subject to cancellation if the PSI forecast reaches the unhealthy range.",
  ].join(" ");
}

/** "The night": the featured edition's poster and details, or the monthly rhythm between dates. */
export function Details({
  edition,
  openFor,
}: {
  edition: Edition | null;
  /** The date taking sign-ups now, if any (not always the one shown). */
  openFor: Edition | null;
}) {
  const venue = edition?.venue;
  return (
    <section id="details" className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
      <div className="grid items-center gap-14 md:grid-cols-[0.9fr_1.1fr] md:gap-20">
        <div className="relative mx-auto w-full max-w-sm -rotate-2 md:max-w-none">
          <span className="tape -top-3 left-6 -rotate-6" aria-hidden="true" />
          <span className="tape -top-3 right-6 rotate-6" aria-hidden="true" />
          {edition?.poster ? (
            <Image
              src={edition.poster.src}
              width={edition.poster.width}
              height={edition.poster.height}
              alt={posterAlt(edition)}
              className="w-full rounded-sm bg-forest shadow-[0_18px_40px_-12px_rgb(31_64_41/0.45)]"
              sizes="(min-width: 768px) 40vw, 90vw"
            />
          ) : (
            <PosterCard
              edition={edition}
              className="w-full rounded-sm shadow-[0_18px_40px_-12px_rgb(31_64_41/0.45)]"
            />
          )}
        </div>

        <div>
          <h2 className="font-brush text-7xl leading-none text-forest sm:text-8xl">the night</h2>
          <p className="mt-4 max-w-md font-serif text-2xl leading-snug text-muted italic">
            Food on the grill, chairs out, good people. Pull one up.
          </p>

          <dl className="mt-8 border-b-2 border-dashed border-forest/20">
            <Row label="When" color="text-orange-ink">
              {edition ? (
                <>
                  <strong className="font-semibold">{eventDateLong(edition)}</strong>
                  <br />
                  {eventTimeRange(edition)}
                  <a
                    href={googleCalendarUrl(edition, siteUrl())}
                    target="_blank"
                    rel="noreferrer"
                    className={linkClass}
                  >
                    Add to calendar
                  </a>
                </>
              ) : (
                <>
                  <strong className="font-semibold">Every month</strong>
                  <br />
                  The next date is coming soon.
                  <a
                    href={`https://instagram.com/${series.contact.instagram}`}
                    target="_blank"
                    rel="noreferrer"
                    className={linkClass}
                  >
                    Follow @{series.contact.instagram} to hear first
                  </a>
                </>
              )}
            </Row>
            <Row label="Where" color="text-red">
              {venue ? (
                <>
                  <strong className="font-semibold">
                    {venue.name}
                    {venue.level && `, ${venue.level}`}
                  </strong>
                  <br />
                  {venue.address}
                  {venue.directions && (
                    <>
                      <br />
                      <span className="text-muted">{venue.directions}</span>
                    </>
                  )}
                  <a href={venueMapsUrl(venue)} target="_blank" rel="noreferrer" className={linkClass}>
                    Open in Maps
                  </a>
                </>
              ) : (
                "Announced with each date."
              )}
            </Row>
            <Row label="What" color="text-forest">
              {series.tagline.join(", ").replace(/^./, (c) => c.toUpperCase())}. Come as
              you are{edition?.maxGuests === 0 ? "." : " — bring a friend or come solo."}
            </Row>
            <Row label="Cost" color="text-vermilion">
              Backyard is free for everyone, with no fixed fee and no expectation of payment.
              We’re a volunteer-run community that keeps going because people pay it forward. If
              Backyard has meant something to you, a contribution of any size helps keep it open
              for the next person.
            </Row>
          </dl>

          {openFor && (
            <Link
              href={`/register?edition=${openFor.slug}`}
              className="btn btn-primary mt-8 px-7 py-4 text-lg"
            >
              {openFor.slug === edition?.slug
                ? "Register for free"
                : `Register for ${eventDateShort(openFor)}`}{" "}
              <span aria-hidden="true">→</span>
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
