"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { describeSlot, type EditionFormValues } from "@/lib/editions/plan";
import { saveEdition, type EditionFormState } from "./actions";

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <p className="mt-2 text-sm font-semibold text-red">{errors[0]}</p>;
}

function Field({
  label,
  hint,
  errors,
  children,
}: {
  label: string;
  hint?: string;
  errors?: string[];
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block font-bold text-forest">
        {label}
        {hint && <span className="ml-2 text-sm font-normal text-muted">{hint}</span>}
      </span>
      {children}
      <FieldError errors={errors} />
    </label>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-5 rounded-2xl border-2 border-forest/15 bg-card p-5 sm:p-6">
      <legend className="px-2 font-heading text-sm tracking-widest text-orange-ink uppercase">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

/** "2026-11-27" → "Friday, 27 November 2026" (the date is already Singapore time). */
const inWords = (date: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? new Date(`${date}T00:00:00Z`).toLocaleDateString("en-SG", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      })
    : "";

/**
 * Create a date (`slug` empty: "Save as draft" / "Save & publish") or edit
 * one ("Save changes"). Times are Singapore time.
 */
export function EditionForm({
  slug,
  version,
  initial,
}: {
  slug?: string;
  /** The edition's updatedAt when the page loaded, so a stale tab can't undo newer changes. */
  version?: string;
  initial: EditionFormValues;
}) {
  const [state, action, pending] = useActionState<EditionFormState, FormData>(saveEdition, {});
  const alertRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state.message) alertRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [state]);

  return (
    <form action={action} className="space-y-6">
      {slug && <input type="hidden" name="slug" value={slug} />}
      {version && <input type="hidden" name="version" value={version} />}

      {state.message && (
        <div
          ref={alertRef}
          role={state.saved ? "status" : "alert"}
          className={`rounded-xl border-2 px-4 py-3 font-semibold ${
            state.saved ? "border-forest bg-lime/40 text-forest-deep" : "border-red bg-red/10 text-red"
          }`}
        >
          {state.message}
        </div>
      )}

      {/* Starts afresh whenever the date changes on the server, so no field
          holds a value from before (e.g. a close time since changed). */}
      <Fields
        key={version ?? "new"}
        values={(state.values ?? initial) as EditionFormValues}
        errors={state.fieldErrors ?? {}}
      />

      <div className="flex flex-wrap gap-3">
        {slug ? (
          <button type="submit" disabled={pending} className="btn btn-primary px-6 py-3">
            {pending ? "Saving…" : "Save changes"}
          </button>
        ) : (
          <>
            <button
              type="submit"
              name="intent"
              value="publish"
              disabled={pending}
              className="btn btn-primary px-6 py-3"
            >
              {pending ? "Saving…" : "Save & publish"}
            </button>
            <button
              type="submit"
              name="intent"
              value="draft"
              disabled={pending}
              className="btn btn-outline px-6 py-3"
            >
              Save as draft
            </button>
          </>
        )}
      </div>
    </form>
  );
}

function Fields({
  values: v,
  errors: e,
}: {
  values: EditionFormValues;
  errors: Partial<Record<string, string[]>>;
}) {
  // Sign-ups close at the start time unless the organiser picks another time.
  const [date, setDate] = useState(v.date);
  const [startTime, setStartTime] = useState(v.startTime);
  const [closesAt, setClosesAt] = useState(v.closesAt);
  const closesFollowsStart = useRef(v.closesAt === `${v.date}T${v.startTime}`);
  useEffect(() => {
    if (closesFollowsStart.current) setClosesAt(`${date}T${startTime}`);
  }, [date, startTime]);

  return (
    <>
      <Group title="When">
        <Field label="Date" errors={e.date}>
          <input
            type="date"
            name="date"
            required
            className="field"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
          {date && (
            <span className="mt-2 block text-sm text-muted">
              {inWords(date)} · {describeSlot(date)}
            </span>
          )}
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Starts" errors={e.startTime}>
            <input
              type="time"
              name="startTime"
              required
              className="field"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
            />
          </Field>
          <Field label="Ends" errors={e.endTime}>
            <input type="time" name="endTime" required className="field" defaultValue={v.endTime} />
          </Field>
        </div>
      </Group>

      <Group title="Sign-ups">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Open" hint="empty: as soon as it’s published" errors={e.opensAt}>
            <input type="datetime-local" name="opensAt" className="field" defaultValue={v.opensAt} />
          </Field>
          <Field label="Close" errors={e.closesAt}>
            <input
              type="datetime-local"
              name="closesAt"
              required
              className="field"
              value={closesAt}
              onChange={(event) => {
                closesFollowsStart.current = false;
                setClosesAt(event.target.value);
              }}
            />
          </Field>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Max people" hint="incl. friends; empty: no limit" errors={e.capacity}>
            <input
              type="number"
              name="capacity"
              min={1}
              max={1000}
              inputMode="numeric"
              className="field"
              defaultValue={v.capacity}
            />
          </Field>
          <Field label="Friends per person" errors={e.maxGuests}>
            <input
              type="number"
              name="maxGuests"
              min={0}
              max={10}
              required
              inputMode="numeric"
              className="field"
              defaultValue={v.maxGuests}
            />
          </Field>
        </div>
        <p className="text-sm text-muted">
          Once it’s full, new sign-ups join the waitlist. Lowering the limit keeps everyone
          already confirmed.
        </p>
      </Group>

      <Group title="Where">
        <div className="grid gap-5 sm:grid-cols-[2fr_1fr]">
          <Field label="Venue" errors={e.venueName}>
            <input name="venueName" required maxLength={120} className="field" defaultValue={v.venueName} />
          </Field>
          <Field label="Level" hint="optional" errors={e.venueLevel}>
            <input
              name="venueLevel"
              maxLength={60}
              className="field"
              placeholder="Level 1"
              defaultValue={v.venueLevel}
            />
          </Field>
        </div>
        <Field label="Address" errors={e.venueAddress}>
          <input name="venueAddress" required maxLength={200} className="field" defaultValue={v.venueAddress} />
        </Field>
        <Field label="Getting there" hint="optional" errors={e.venueDirections}>
          <input
            name="venueDirections"
            maxLength={300}
            className="field"
            placeholder="A short walk from Somerset MRT (NS23)."
            defaultValue={v.venueDirections}
          />
        </Field>
        <Field label="Google Maps link" hint="optional; we search the address otherwise" errors={e.venueMapsUrl}>
          <input
            name="venueMapsUrl"
            type="url"
            maxLength={500}
            className="field"
            placeholder="https://maps.app.goo.gl/…"
            defaultValue={v.venueMapsUrl}
          />
        </Field>
      </Group>

      <Group title="Note for guests">
        <Field
          label="Shown on the homepage, sign-up page, passes and emails"
          hint="optional"
          errors={e.notice}
        >
          <textarea
            name="notice"
            rows={2}
            maxLength={500}
            className="field resize-y"
            placeholder="e.g. We’ve moved indoors to Level 2 because of the rain."
            defaultValue={v.notice}
          />
        </Field>
      </Group>

    </>
  );
}
