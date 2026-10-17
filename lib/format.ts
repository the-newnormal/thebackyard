import { series } from "@/content/series";

const tz = { timeZone: series.timeZone } as const;

type Timed = { startsAt: string; endsAt: string };
type Started = Pick<Timed, "startsAt">;

const fmt = (date: Date, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-SG", { ...tz, ...options }).format(date);

const time = (date: Date) =>
  fmt(date, { hour: "numeric", minute: "2-digit", hour12: true })
    .replace(/\s?([ap])\.?m\.?/i, (_, p: string) => `${p.toUpperCase()}M`)
    .replace(/\s/g, "");

/** e.g. "6:30–9:30PM" */
export function eventTimeRange(edition: Timed): string {
  const [s, e] = [time(new Date(edition.startsAt)), time(new Date(edition.endsAt))];
  const sameHalf = s.slice(-2) === e.slice(-2);
  return `${sameHalf ? s.slice(0, -2) : s}–${e}`;
}

/** e.g. "30 October" */
export const eventDayMonth = (edition: Started) =>
  fmt(new Date(edition.startsAt), { day: "numeric", month: "long" });

/** e.g. "Fri" */
export const eventWeekdayShort = (edition: Started) =>
  fmt(new Date(edition.startsAt), { weekday: "short" });

/** e.g. "Friday, 30 October 2026" */
export const eventDateLong = (edition: Started) =>
  fmt(new Date(edition.startsAt), {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

/** e.g. "Fri 27 Nov" */
export const eventDateShort = (edition: Started) => shortDate(new Date(edition.startsAt));

const shortDate = (date: Date) =>
  `${fmt(date, { weekday: "short" })} ${fmt(date, { day: "numeric" })} ${fmt(date, { month: "short" })}`;

/** e.g. "Sun 1 Nov, 12PM" or "Fri 30 Oct, 6:30PM" */
export function formatMoment(iso: string): string {
  const date = new Date(iso);
  return `${shortDate(date)}, ${time(date).replace(/:00(?=[AP]M)/, "")}`;
}

export function formatTimestamp(iso: string): string {
  return fmt(new Date(iso), {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "Level 1" → "L1"; anything else as typed. */
export function venueLevelShort(level: string | null): string | null {
  if (!level) return null;
  const match = /^level\s+(\w+)$/i.exec(level.trim());
  return match ? `L${match[1].toUpperCase()}` : level.trim();
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

/** The venue's own Maps link, or a search for its name and address. */
export function venueMapsUrl(venue: { name: string; address: string; mapsUrl: string | null }) {
  if (venue.mapsUrl) return venue.mapsUrl;
  const query = encodeURIComponent(`${venue.name}, ${venue.address}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}
