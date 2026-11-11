"use client";

import { useMemo, useState } from "react";
import { ConfirmButton, SubmitButton } from "@/components/confirm-button";
import { formatTimestamp } from "@/lib/format";
import { ageOnDay } from "@/lib/registrations/demographics";
import { normalizePhone } from "@/lib/registrations/phone";
import {
  DIETARY_OPTIONS,
  HEARD_FROM_OPTIONS,
  partySize,
  type Registration,
} from "@/lib/registrations/types";
import {
  cancelRegistration,
  deleteRegistration,
  giveSpot,
  restoreRegistration,
  setCheckedIn,
} from "./actions";

const FILTERS = [
  { key: "active", label: "All active" },
  { key: "confirmed", label: "Confirmed" },
  { key: "waitlist", label: "Waitlist" },
  { key: "checked-in", label: "Checked in" },
  { key: "cancelled", label: "Cancelled" },
  // Offers made from the pass, cancelled sign-ups included: they may still help.
  { key: "can-help", label: "Can help" },
] as const;
type Filter = (typeof FILTERS)[number]["key"];

const dietaryLabel = Object.fromEntries(DIETARY_OPTIONS.map((o) => [o.value, o.label]));
const heardLabel = Object.fromEntries(HEARD_FROM_OPTIONS.map((o) => [o.value, o.label]));

function matches(r: Registration, filter: Filter): boolean {
  switch (filter) {
    case "active":
      return r.status !== "cancelled";
    case "checked-in":
      return Boolean(r.checkedInAt) && r.status !== "cancelled";
    case "can-help":
      return r.helpWith !== null;
    default:
      return r.status === filter;
  }
}

export function RegistrationList({
  registrations,
  allowPromote,
  autoFill,
  spotsLeft,
  eventDay,
}: {
  registrations: Registration[];
  /** False once the date is over or called off. */
  allowPromote: boolean;
  /** True until it starts: freed spots go to the waitlist by themselves. */
  autoFill: boolean;
  /** People who can still be confirmed; null with no limit. */
  spotsLeft: number | null;
  /** The date's day (YYYY-MM-DD), for ages on the day. */
  eventDay: string;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("active");

  // Place in line: the store lists the waitlist's order backwards.
  const queue = useMemo(
    () => registrations.filter((r) => r.status === "waitlist").reverse(),
    [registrations],
  );
  const places = useMemo(() => new Map(queue.map((r, i) => [r.code, i + 1])), [queue]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    // Only treat the query as a phone number if it looks like one, so a code
    // like "N299QS" doesn't also match every phone containing "299".
    const phoneQuery = /^[\d\s()+-]+$/.test(q) ? normalizePhone(q) : "";
    // Postal codes as the list shows them ("S238801") or as people write them ("238 801").
    const postalQuery = /^s?[\d\s]+$/.test(q) ? q.replace(/^s|\s/g, "") : "";
    // The waitlist reads top to bottom in the order spots are given out.
    const rows = filter === "waitlist" ? queue : registrations;
    return rows.filter(
      (r) =>
        matches(r, filter) &&
        (!q ||
          r.name.toLowerCase().includes(q) ||
          r.email.includes(q) ||
          r.school?.toLowerCase().includes(q) ||
          (postalQuery !== "" && r.postalCode?.includes(postalQuery)) ||
          (phoneQuery !== "" && normalizePhone(r.phone).includes(phoneQuery)) ||
          r.code.toLowerCase().includes(q)),
    );
  }, [registrations, queue, query, filter]);

  return (
    <section className="mt-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, email, phone, school, postal code or code"
          aria-label="Search registrations"
          className="field md:max-w-sm"
        />
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter registrations">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              aria-pressed={filter === f.key}
              className={`rounded-full border-2 px-3 py-1.5 text-sm font-semibold transition-colors ${
                filter === f.key
                  ? "border-forest bg-forest text-cream"
                  : "border-forest/20 bg-card text-forest hover:border-forest"
              }`}
            >
              {f.label}
              <span className="ml-1.5 opacity-70">
                {registrations.filter((r) => matches(r, f.key)).length}
              </span>
            </button>
          ))}
        </div>
      </div>

      <ul className="mt-4 divide-y-2 divide-forest/10 overflow-hidden rounded-2xl border-2 border-forest/15 bg-card">
        {visible.length === 0 && (
          <li className="p-8 text-center text-muted">
            {registrations.length === 0 ? "No registrations yet." : "Nothing matches."}
          </li>
        )}
        {visible.map((r) => (
          <Row
            key={r.code}
            registration={r}
            place={places.get(r.code) ?? 0}
            allowPromote={allowPromote}
            autoFill={autoFill}
            spotsLeft={spotsLeft}
            eventDay={eventDay}
          />
        ))}
      </ul>
    </section>
  );
}

function Row({
  registration: r,
  place,
  allowPromote,
  autoFill,
  spotsLeft,
  eventDay,
}: {
  registration: Registration;
  /** 1 for next in line; 0 if not waiting. */
  place: number;
  allowPromote: boolean;
  autoFill: boolean;
  spotsLeft: number | null;
  eventDay: string;
}) {
  const checkedIn = Boolean(r.checkedInAt);
  const fits = spotsLeft === null || partySize(r) <= spotsLeft;
  const age = ageOnDay(r, eventDay);
  const about = [
    r.residentStatus,
    r.sex,
    r.race,
    age === null ? null : `${age} on the day`,
    r.occupation,
    r.school,
    r.postalCode && `S${r.postalCode}`,
  ].filter(Boolean);
  return (
    <li className={`grid gap-4 p-4 md:grid-cols-[1fr_auto] md:items-center ${r.status === "cancelled" ? "opacity-60" : ""}`}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-lg font-bold text-ink">{r.name}</p>
          <span className="rounded-md bg-cream px-2 py-0.5 font-mono text-sm font-bold tracking-wider text-forest">
            {r.code}
          </span>
          <StatusBadge registration={r} place={place} />
          {r.walkIn && (
            <span className="rounded-full bg-orange/20 px-2 py-0.5 text-xs font-bold text-forest-deep">
              Walk-in
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-muted">
          {/* Walk-ins needn't give an email or a number. */}
          {r.email && (
            <>
              <a href={`mailto:${r.email}`} className="hover:text-forest hover:underline">
                {r.email}
              </a>
              {" · "}
            </>
          )}
          {r.phone && (
            <>
              <a href={`tel:${r.phone}`} className="hover:text-forest hover:underline">
                {r.phone}
              </a>
              {r.phoneVerified && (
                <span className="text-forest" title="Confirmed with a texted code">
                  {" "}
                  ✓ verified
                </span>
              )}
              {" · "}
            </>
          )}
          registered {formatTimestamp(r.createdAt)}
        </p>
        {/* Folded away so the check-in table shows only what it needs. */}
        {about.length > 0 && (
          <details className="mt-1 text-sm">
            <summary className="w-fit cursor-pointer font-semibold text-muted hover:text-forest">
              About
            </summary>
            <p className="mt-1 text-ink">{about.join(" · ")}</p>
          </details>
        )}
        <p className="mt-1 text-sm">
          {r.guests > 0 && (
            <>
              <strong>Party of {partySize(r)}</strong>
              {" · "}
            </>
          )}
          {dietaryLabel[r.dietary] ?? r.dietary}
          {r.dietaryNotes && <span className="text-red"> · “{r.dietaryNotes}”</span>}
          {r.heardFrom && <span className="text-muted"> · via {heardLabel[r.heardFrom]}</span>}
        </p>
        {r.helpWith && (
          <p className="mt-1 text-sm [overflow-wrap:anywhere]">
            <span className="font-semibold text-forest">Can help:</span> {r.helpWith.join(", ")}
            {r.helpNote && <span className="text-muted"> · “{r.helpNote}”</span>}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 md:justify-end">
        {r.status === "confirmed" && !checkedIn && (
          <form action={setCheckedIn}>
            <input type="hidden" name="code" value={r.code} />
            <input type="hidden" name="checkedIn" value="true" />
            <SubmitButton
              pendingLabel="Checking in…"
              className="rounded-full bg-forest px-4 py-2 text-sm font-bold text-cream transition-colors hover:bg-orange hover:text-forest-deep disabled:opacity-60"
            >
              Check in
            </SubmitButton>
          </form>
        )}
        {checkedIn && (
          // Undo sits behind a confirm so a late second tap on "Check in" can't undo it.
          <form action={setCheckedIn}>
            <input type="hidden" name="code" value={r.code} />
            <input type="hidden" name="checkedIn" value="false" />
            <ConfirmButton
              confirm={`Undo ${r.name}'s check-in?`}
              className="rounded-full px-3 py-2 text-sm font-semibold text-muted hover:text-red"
            >
              Undo check-in
            </ConfirmButton>
          </form>
        )}
        {r.status === "waitlist" && allowPromote && (
          <form action={giveSpot}>
            <input type="hidden" name="code" value={r.code} />
            {fits ? (
              <button
                type="submit"
                className="rounded-full border-2 border-forest/20 px-4 py-2 text-sm font-bold text-forest hover:border-forest"
              >
                Give a spot
              </button>
            ) : (
              // Full: over the limit without raising it, so the sign-up form stays full.
              <>
                <input type="hidden" name="overLimit" value="true" />
                <ConfirmButton
                  confirm={`No spots are free. Give ${r.name}${partySize(r) > 1 ? ` (party of ${partySize(r)})` : ""} a spot over the limit? The limit stays as it is, so nobody new gets in through the sign-up form.`}
                  className="rounded-full border-2 border-dashed border-forest/30 px-4 py-2 text-sm font-bold text-forest hover:border-forest"
                >
                  Give a spot
                </ConfirmButton>
              </>
            )}
          </form>
        )}
        {r.status === "cancelled" ? (
          <form action={restoreRegistration}>
            <input type="hidden" name="code" value={r.code} />
            <button
              type="submit"
              className="rounded-full border-2 border-forest/20 px-4 py-2 text-sm font-bold text-forest hover:border-forest"
            >
              Restore
            </button>
          </form>
        ) : (
          <form action={cancelRegistration}>
            <input type="hidden" name="code" value={r.code} />
            <ConfirmButton
              confirm={`Cancel ${r.name}'s registration?${autoFill ? " If anyone's waiting, the spot goes to whoever's next." : ""}`}
              className="rounded-full px-3 py-2 text-sm font-semibold text-muted hover:text-red"
            >
              Cancel
            </ConfirmButton>
          </form>
        )}
        <form action={deleteRegistration}>
          <input type="hidden" name="code" value={r.code} />
          <ConfirmButton
            confirm={`Permanently delete ${r.name}'s details? This can't be undone.`}
            className="rounded-full px-3 py-2 text-sm font-semibold text-muted hover:text-red"
          >
            Delete
          </ConfirmButton>
        </form>
      </div>
    </li>
  );
}

function StatusBadge({ registration: r, place }: { registration: Registration; place: number }) {
  if (r.status === "cancelled") {
    return <span className="rounded-full bg-forest/10 px-2 py-0.5 text-xs font-bold text-muted">Cancelled</span>;
  }
  if (r.checkedInAt) {
    return <span className="rounded-full bg-lime px-2 py-0.5 text-xs font-bold text-forest-deep">Checked in</span>;
  }
  if (r.status === "waitlist") {
    return (
      <span className="rounded-full bg-mustard px-2 py-0.5 text-xs font-bold text-forest-deep">
        Waitlist · #{place}
      </span>
    );
  }
  return null;
}
