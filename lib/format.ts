import { event } from "@/content/event";

const tz = { timeZone: event.timeZone } as const;

const start = new Date(event.startsAt);
const end = new Date(event.endsAt);

const fmt = (date: Date, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-SG", { ...tz, ...options }).format(date);

const time = (date: Date) =>
  fmt(date, { hour: "numeric", minute: "2-digit", hour12: true })
    .replace(/\s?([ap])\.?m\.?/i, (_, p: string) => `${p.toUpperCase()}M`)
    .replace(/\s/g, "");

/** e.g. "6:30–9:30PM" */
export function eventTimeRange(): string {
  const [s, e] = [time(start), time(end)];
  const sameHalf = s.slice(-2) === e.slice(-2);
  return `${sameHalf ? s.slice(0, -2) : s}–${e}`;
}

/** e.g. "30 October" */
export const eventDayMonth = () => fmt(start, { day: "numeric", month: "long" });

/** e.g. "Fri" */
export const eventWeekdayShort = () => fmt(start, { weekday: "short" });

/** e.g. "Friday, 30 October 2026" */
export const eventDateLong = () =>
  fmt(start, { weekday: "long", day: "numeric", month: "long", year: "numeric" });

export function formatTimestamp(iso: string): string {
  return fmt(new Date(iso), {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}
