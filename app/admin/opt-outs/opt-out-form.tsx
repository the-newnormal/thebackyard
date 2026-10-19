"use client";

import { useActionState } from "react";
import { addOptOut } from "../actions";

export function OptOutForm() {
  const [state, action, pending] = useActionState(addOptOut, {});
  return (
    <form action={action} className="mt-6 rounded-2xl border-2 border-forest/15 bg-card p-5">
      <label htmlFor="opt-out-contact" className="mb-2 block font-bold text-forest">
        Email address or mobile number
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          id="opt-out-contact"
          name="contact"
          required
          autoComplete="off"
          // Kept after a mistake, so it can be fixed rather than retyped.
          defaultValue={state.value}
          placeholder="name@example.com or 9123 4567"
          className="field"
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? "opt-out-error" : undefined}
        />
        <button type="submit" disabled={pending} className="btn btn-primary shrink-0 px-5 py-3">
          {pending ? "Saving…" : "Opt out"}
        </button>
      </div>
      {state.error && (
        <p id="opt-out-error" role="alert" className="mt-2 text-sm font-semibold text-red">
          {state.error}
        </p>
      )}
      {state.added && (
        <p role="status" className="mt-2 text-sm font-semibold text-forest">
          {state.added} won’t get updates any more.
        </p>
      )}
    </form>
  );
}
