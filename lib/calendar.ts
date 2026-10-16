import { event } from "@/content/event";

const location = `${event.venue.name}, ${event.venue.level}, ${event.venue.address}`;

const icsDate = (iso: string) =>
  new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

const escape = (text: string) =>
  text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

export function buildIcs(url: string): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Backyard//Community BBQ//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.slug}@backyard`,
    `DTSTAMP:${icsDate(event.startsAt)}`,
    `DTSTART:${icsDate(event.startsAt)}`,
    `DTEND:${icsDate(event.endsAt)}`,
    `SUMMARY:${escape(event.name)}`,
    `DESCRIPTION:${escape(`${event.tagline.join(" | ")}\n${url}`)}`,
    `LOCATION:${escape(location)}`,
    `URL:${url}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

export function googleCalendarUrl(url: string): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.name,
    dates: `${icsDate(event.startsAt)}/${icsDate(event.endsAt)}`,
    details: `${event.tagline.join(" | ")}\n${url}`,
    location,
    ctz: event.timeZone,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}
