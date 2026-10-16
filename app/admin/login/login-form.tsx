"use client";

import { useActionState } from "react";
import { login } from "../actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, {});
  return (
    <form action={action} className="mt-8 space-y-4">
      <div>
        <label htmlFor="password" className="mb-2 block font-bold text-forest">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          autoFocus
          className="field"
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? "password-error" : undefined}
        />
        {state.error && (
          <p id="password-error" role="alert" className="mt-2 text-sm font-semibold text-red">
            {state.error}
          </p>
        )}
      </div>
      <button type="submit" disabled={pending} className="btn btn-primary w-full">
        {pending ? "Checking…" : "Sign in"}
      </button>
    </form>
  );
}
