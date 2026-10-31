"use client";

import { useActionState } from "react";
import { DIETARY_OPTIONS } from "@/lib/registrations/types";
import { addWalkIn } from "./actions";

/** "Add a walk-in": someone let in on the night without signing up. */
export function WalkInForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState(addWalkIn, {});
  // Kept after a mistake, so it can be fixed rather than retyped.
  const v = state.values;
  return (
    <form action={action} className="mt-8 rounded-2xl border-2 border-forest/15 bg-card p-5">
      <input type="hidden" name="slug" value={slug} />
      <h2 className="font-bold text-forest">Add a walk-in</h2>
      <p className="mt-1 text-sm text-muted">
        For someone who didn’t sign up. They’re added as checked in, even if it’s full.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-forest">Name</span>
          <input name="name" required maxLength={80} autoComplete="off" className="field" defaultValue={v?.name} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-forest">Email</span>
          <input
            name="email"
            type="email"
            required
            maxLength={200}
            autoComplete="off"
            className="field"
            defaultValue={v?.email}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-forest">
            Mobile <span className="font-normal text-muted">optional</span>
          </span>
          <input name="phone" type="tel" autoComplete="off" className="field" defaultValue={v?.phone} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-forest">Dietary</span>
          {/* Keyed: a select only takes a new defaultValue when it mounts. */}
          <select
            key={v?.dietary ?? "none"}
            name="dietary"
            className="field"
            defaultValue={v?.dietary ?? "none"}
          >
            {DIETARY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="mt-3 flex cursor-pointer items-start gap-3 text-ink">
        <input
          type="checkbox"
          name="wantsUpdates"
          defaultChecked={v?.wantsUpdates === "on"}
          className="mt-0.5 size-5 shrink-0 accent-forest"
        />
        <span>
          They’d like updates about future Backyards
          <span className="block text-sm text-muted">
            Ask them: walk-ins haven’t agreed to updates through the sign-up form.
          </span>
        </span>
      </label>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="btn btn-primary px-5 py-2.5">
          {pending ? "Adding…" : "Add & check in"}
        </button>
        {state.error && (
          <p role="alert" className="text-sm font-semibold text-red">
            {state.error}
          </p>
        )}
        {state.added && (
          <p role="status" className="text-sm font-semibold text-forest">
            {state.added.restored
              ? `${state.added.name} had cancelled their sign-up; it’s back and checked in (${state.added.code}).`
              : `${state.added.name} is in and checked in (${state.added.code}).`}
          </p>
        )}
      </div>
    </form>
  );
}
