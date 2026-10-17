import { series } from "@/content/series";
import type { Edition } from "./editions/types";

const location = ({ venue }: Edition) =>
  [venue.name, venue.level, venue.address].filter(Boolean).join(", ");

const icsDate = (date: string | Date) =>
  new Date(date).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

const escape = (text: string) =>
  text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Lines over 75 octets are folded onto continuation lines starting with a space. */
function fold(line: string): string {
  const chunks: string[] = [];
  let chunk = "";
  let size = 0;
  for (const char of line) {
    const bytes = Buffer.byteLength(char);
    if (size + bytes > (chunks.length ? 74 : 75)) {
      chunks.push(chunk);
      chunk = "";
      size = 0;
    }
    chunk += char;
    size += bytes;
  }
  chunks.push(chunk);
  return chunks.join("\r\n ");
}

const details = (edition: Edition, url: string) =>
  [series.tagline.join(" | "), edition.notice, url].filter(Boolean).join("\n");

const title = (edition: Edition) =>
  edition.status === "cancelled" ? `Called off: ${series.name}` : series.name;

export function buildIcs(edition: Edition, url: string, now: Date): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Backyard//Community BBQ//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    // Stable per edition, so re-importing updates the event instead of duplicating it.
    `UID:${edition.slug}@backyard`,
    `DTSTAMP:${icsDate(now)}`,
    `DTSTART:${icsDate(edition.startsAt)}`,
    `DTEND:${icsDate(edition.endsAt)}`,
    `STATUS:${edition.status === "cancelled" ? "CANCELLED" : "CONFIRMED"}`,
    `SUMMARY:${escape(title(edition))}`,
    `DESCRIPTION:${escape(details(edition, url))}`,
    `LOCATION:${escape(location(edition))}`,
    `URL:${url}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ]
    .map(fold)
    .join("\r\n");
}

export function googleCalendarUrl(edition: Edition, url: string): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title(edition),
    dates: `${icsDate(edition.startsAt)}/${icsDate(edition.endsAt)}`,
    details: details(edition, url),
    location: location(edition),
    ctz: series.timeZone,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}
