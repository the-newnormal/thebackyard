import { event } from "@/content/event";
import { isAdmin } from "@/lib/admin-auth";
import { getStore, partySize, type Registration } from "@/lib/registrations";
import { ageOnEventDay } from "@/lib/registrations/demographics";

const COLUMNS: [string, (r: Registration) => string | number | boolean | null][] = [
  ["code", (r) => r.code],
  ["status", (r) => r.status],
  ["name", (r) => r.name],
  ["email", (r) => r.email],
  ["phone", (r) => r.phone],
  ["phone_verified", (r) => r.phoneVerified],
  ["resident_status", (r) => r.residentStatus],
  ["sex", (r) => r.sex],
  ["race", (r) => r.race],
  ["birthdate", (r) => r.birthdate],
  ["age_on_event_day", (r) => ageOnEventDay(r)],
  ["occupation", (r) => r.occupation],
  ["school", (r) => r.school],
  ["party_size", (r) => partySize(r)],
  ["guests", (r) => r.guests],
  ["dietary", (r) => r.dietary],
  ["dietary_notes", (r) => r.dietaryNotes],
  ["heard_from", (r) => r.heardFrom],
  ["wants_updates", (r) => r.marketingOptIn],
  ["checked_in_at", (r) => r.checkedInAt],
  ["registered_at", (r) => r.createdAt],
];

function cell(value: string | number | boolean | null): string {
  let text = value === null ? "" : String(value);
  // Stop spreadsheet apps from treating user input as a formula.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function GET() {
  if (!(await isAdmin())) {
    return new Response("Unauthorized", { status: 401 });
  }
  const rows = await getStore().list(event.slug);
  const csv = [
    COLUMNS.map(([name]) => name).join(","),
    ...rows.map((r) => COLUMNS.map(([, get]) => cell(get(r))).join(",")),
  ].join("\r\n");

  return new Response(`﻿${csv}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="backyard-${event.slug}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
