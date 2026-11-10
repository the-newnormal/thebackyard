import type { NextRequest } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { adminFocus } from "@/lib/editions/select";
import { getStore, partySize, type Registration } from "@/lib/registrations";
import { ageOnDay, editionDay } from "@/lib/registrations/demographics";
import { optOutSet, wantsUpdates } from "@/lib/registrations/opt-outs";

type Column = [string, (r: Registration) => string | number | boolean | null];

/** `day`: the edition's date, for ages on the day. */
const columns = (day: string, optedOut: ReadonlySet<string>): Column[] => [
  ["code", (r) => r.code],
  ["status", (r) => r.status],
  ["walk_in", (r) => r.walkIn],
  ["name", (r) => r.name],
  ["email", (r) => r.email],
  ["phone", (r) => r.phone],
  ["phone_verified", (r) => r.phoneVerified],
  ["resident_status", (r) => r.residentStatus],
  ["sex", (r) => r.sex],
  ["race", (r) => r.race],
  ["birthdate", (r) => r.birthdate],
  ["age_on_event_day", (r) => ageOnDay(r, day)],
  ["occupation", (r) => r.occupation],
  ["school", (r) => r.school],
  ["postal_code", (r) => r.postalCode],
  ["party_size", (r) => partySize(r)],
  ["guests", (r) => r.guests],
  ["dietary", (r) => r.dietary],
  ["dietary_notes", (r) => r.dietaryNotes],
  ["heard_from", (r) => r.heardFrom],
  ["wants_updates", (r) => wantsUpdates(r, optedOut)],
  ["checked_in_at", (r) => r.checkedInAt],
  ["registered_at", (r) => r.createdAt],
];

function cell(value: string | number | boolean | null): string {
  let text = value === null ? "" : String(value);
  // Stop spreadsheet apps from treating user input as a formula.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** `/admin/export?edition=<slug>`; without it, the dashboard's default date. */
export async function GET(request: NextRequest) {
  if (!(await isAdmin())) {
    return new Response("Unauthorized", { status: 401 });
  }
  const store = getStore();
  const editions = await store.listEditions();
  const requested = request.nextUrl.searchParams.get("edition");
  const edition = requested
    ? editions.find((e) => e.slug === requested)
    : adminFocus(editions, new Date());
  if (!edition) return new Response("No such date", { status: 404 });
  const [rows, optOuts] = await Promise.all([store.list(edition.slug), store.listOptOuts()]);
  const cols = columns(editionDay(edition), optOutSet(optOuts));
  const csv = [
    cols.map(([name]) => name).join(","),
    ...rows.map((r) => cols.map(([, get]) => cell(get(r))).join(",")),
  ].join("\r\n");

  return new Response(`﻿${csv}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="backyard-${edition.slug}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
