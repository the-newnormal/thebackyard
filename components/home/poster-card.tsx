import { series } from "@/content/series";
import type { Edition } from "@/lib/editions/types";
import { eventDayMonth, eventTimeRange, eventWeekdayShort } from "@/lib/format";
import { Splat, Starburst } from "../shapes";

/**
 * Stand-in for a poster, in the same proportions, for editions that don't have
 * one yet (or when no date is announced). `compact` is for thumbnails.
 */
export function PosterCard({
  edition,
  compact = false,
  className = "",
}: {
  edition: Edition | null;
  compact?: boolean;
  className?: string;
}) {
  const date = edition ? (
    <>
      {eventWeekdayShort(edition).toLowerCase()}
      <br />
      {eventDayMonth(edition).toLowerCase()}
    </>
  ) : (
    <>
      next date
      <br />
      coming soon
    </>
  );

  return (
    <div
      aria-hidden={compact || undefined}
      className={`relative isolate flex aspect-[4/5] flex-col items-center justify-center overflow-hidden bg-forest p-[8%] text-center ${className}`}
    >
      <Splat
        id={`poster-splat-${compact ? "sm-" : ""}${edition?.slug ?? "tba"}`}
        color="var(--color-forest-deep)"
        className="absolute -inset-[12%] -z-10 h-[124%] w-[124%] max-w-none opacity-70"
      />
      <Starburst
        variant={1}
        color="var(--color-orange)"
        scribble={false}
        className="absolute -top-[6%] -right-[8%] -z-10 w-[34%] rotate-12"
      />
      {compact ? (
        <>
          <p className="font-display text-sm leading-none text-lime">BACKYARD</p>
          <p className="mt-2 font-brush text-xl leading-[0.95] text-cream">{date}</p>
        </>
      ) : (
        <>
          <p className="font-serif text-[clamp(0.9rem,2.6vw,1.25rem)] text-lime italic">
            {series.tagline.join(" | ")}
          </p>
          <p className="mt-2 font-display text-[clamp(2.2rem,8vw,4rem)] leading-none text-lime">
            BACKYARD
          </p>
          <p className="mt-1 font-serif text-[clamp(1.1rem,3.4vw,1.6rem)] text-cream italic">
            {series.shortName.toLowerCase()}
          </p>
          <p className="mt-[10%] font-brush text-[clamp(2.4rem,9vw,4.5rem)] leading-[0.95] text-cream">
            {date}
          </p>
          {edition && (
            <p className="mt-[6%] font-condensed text-[clamp(1rem,3vw,1.4rem)] leading-tight text-lime">
              {eventTimeRange(edition)}
              <br />
              {edition.venue.name}
            </p>
          )}
        </>
      )}
    </div>
  );
}
