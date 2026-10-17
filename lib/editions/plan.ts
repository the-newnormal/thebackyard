import { FIRST_EDITION_SEED, series } from "@/content/series";
import type { Edition } from "./types";

// Dates in admin forms are Singapore wall-clock time. Vercel runs in UTC, so
// never rely on the server's local time zone: build instants with the offset.

const [, sign, hh, mm] = /^([+-])(\d\d):(\d\d)$/.exec(series.utcOffset)!;
const OFFSET_MS = (sign === "-" ? -1 : 1) * (Number(hh) * 60 + Number(mm)) * 60_000;

/** "2026-10-30" + "18:30" in Singapore → ISO instant. */
export function sgtInstant(date: string, time: string): string {
  return new Date(`${date}T${time}:00${series.utcOffset}`).toISOString();
}

/** ISO instant → Singapore date ("2026-10-30") and time ("18:30"). */
export function sgtParts(iso: string): { date: string; time: string } {
  const shifted = new Date(new Date(iso).getTime() + OFFSET_MS).toISOString();
  return { date: shifted.slice(0, 10), time: shifted.slice(11, 16) };
}

/** Value for <input type="datetime-local">. */
export const sgtLocal = (iso: string) => {
  const { date, time } = sgtParts(iso);
  return `${date}T${time}`;
};

const ymd = (date: string) => date.split("-").map(Number) as [number, number, number];
const daysIn = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();
const weekdayOf = (year: number, month: number, day: number) =>
  new Date(Date.UTC(year, month - 1, day)).getUTCDay();
const pad = (n: number) => String(n).padStart(2, "0");

/** True if `date` is the last of its weekday in its month. */
const isLastWeekday = (date: string) => {
  const [y, m, d] = ymd(date);
  return d + 7 > daysIn(y, m);
};

/**
 * The same slot next month: the last Friday stays the last Friday, the
 * second Friday stays the second Friday.
 */
export function nextMonthDate(date: string): string {
  const [y, m, d] = ymd(date);
  const weekday = weekdayOf(y, m, d);
  const [ny, nm] = m === 12 ? [y + 1, 1] : [y, m + 1];
  const first = (weekday - weekdayOf(ny, nm, 1) + 7) % 7 + 1;
  let day: number;
  if (isLastWeekday(date)) {
    day = first;
    while (day + 7 <= daysIn(ny, nm)) day += 7;
  } else {
    day = first + 7 * Math.floor((d - 1) / 7);
  }
  return `${ny}-${pad(nm)}-${pad(day)}`;
}

const ORDINALS = ["1st", "2nd", "3rd", "4th", "5th"];

/** e.g. "Last Friday of November" or "2nd Saturday of March". */
export function describeSlot(date: string): string {
  const [y, m, d] = ymd(date);
  const utc = new Date(Date.UTC(y, m - 1, d));
  const weekday = utc.toLocaleDateString("en-SG", { weekday: "long", timeZone: "UTC" });
  const month = utc.toLocaleDateString("en-SG", { month: "long", timeZone: "UTC" });
  const which = isLastWeekday(date) ? "Last" : ORDINALS[Math.floor((d - 1) / 7)];
  return `${which} ${weekday} of ${month}`;
}

/**
 * Slugs follow the existing `community-bbq-2026-10`. A second edition in the
 * same month adds the day, then a counter.
 */
export function slugFor(startsAt: string, taken: Set<string>): string {
  const { date } = sgtParts(startsAt);
  const [y, m, d] = ymd(date);
  const base = `community-bbq-${y}-${pad(m)}`;
  if (!taken.has(base)) return base;
  const withDay = `${base}-${pad(d)}`;
  if (!taken.has(withDay)) return withDay;
  for (let n = 2; ; n++) {
    if (!taken.has(`${withDay}-${n}`)) return `${withDay}-${n}`;
  }
}

/** What the edition form edits, as the strings its inputs hold. */
export interface EditionFormValues {
  date: string;
  startTime: string;
  endTime: string;
  /** datetime-local value, or "" to open as soon as it's published. */
  opensAt: string;
  closesAt: string;
  capacity: string;
  maxGuests: string;
  venueName: string;
  venueLevel: string;
  venueAddress: string;
  venueDirections: string;
  venueMapsUrl: string;
  notice: string;
}

export function toFormValues(edition: Edition): EditionFormValues {
  const start = sgtParts(edition.startsAt);
  return {
    date: start.date,
    startTime: start.time,
    endTime: sgtParts(edition.endsAt).time,
    opensAt: edition.registrationOpensAt ? sgtLocal(edition.registrationOpensAt) : "",
    closesAt: sgtLocal(edition.registrationClosesAt),
    capacity: edition.capacity === null ? "" : String(edition.capacity),
    maxGuests: String(edition.maxGuests),
    venueName: edition.venue.name,
    venueLevel: edition.venue.level ?? "",
    venueAddress: edition.venue.address,
    venueDirections: edition.venue.directions ?? "",
    venueMapsUrl: edition.venue.mapsUrl ?? "",
    notice: edition.notice ?? "",
  };
}

/**
 * Defaults for "Plan next month": the same slot in the next month that
 * doesn't have a date yet (`taken`: Singapore dates already planned), with
 * the same times, venue and limits. Sign-ups open when the source edition's
 * close, so people at the BBQ can sign up for the next one, and close at the
 * start. The poster and notes are specific to one date, so they're left out.
 */
export function planDefaults(
  source: Edition | null,
  now: Date,
  taken: Set<string> = new Set(),
): EditionFormValues {
  const template = source ?? {
    ...FIRST_EDITION_SEED,
    venue: { ...FIRST_EDITION_SEED.venue },
    poster: null,
    calledOffNote: null,
    createdAt: FIRST_EDITION_SEED.startsAt,
    updatedAt: FIRST_EDITION_SEED.startsAt,
  };
  const values = toFormValues(template);

  let date = nextMonthDate(values.date);
  while (taken.has(date) || new Date(sgtInstant(date, values.startTime)) <= now) {
    date = nextMonthDate(date);
  }

  const opensAt =
    source && new Date(source.registrationClosesAt) > now ? sgtLocal(source.registrationClosesAt) : "";

  return {
    ...values,
    date,
    opensAt,
    // At the start, not copied: the source may have been closed early by hand.
    closesAt: `${date}T${values.startTime}`,
    notice: "",
  };
}
