"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { register, type RegisterState } from "@/app/register/actions";
import { DIETARY_OPTIONS, HEARD_FROM_OPTIONS } from "@/lib/registrations/types";

const guestOptions = (maxGuests: number) =>
  Array.from({ length: maxGuests + 1 }, (_, n) => ({
    value: String(n),
    label: n === 0 ? "Just me" : `Me + ${n}`,
  }));

function FieldError({ id, errors }: { id: string; errors?: string[] }) {
  if (!errors?.length) return null;
  return (
    <p id={id} className="mt-2 text-sm font-semibold text-red">
      {errors[0]}
    </p>
  );
}

function Label({ htmlFor, children, hint }: { htmlFor?: string; children: React.ReactNode; hint?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-2 block font-bold text-forest">
      {children}
      {hint && <span className="ml-2 text-sm font-normal text-muted">{hint}</span>}
    </label>
  );
}

export function RegistrationForm({
  edition,
  maxGuests,
  organiser,
  waitlist = false,
}: {
  /** Slug of the edition this form signs people up for. */
  edition: string;
  maxGuests: number;
  organiser: string;
  waitlist?: boolean;
}) {
  const [state, action, pending] = useActionState<RegisterState, FormData>(register, {});
  const formRef = useRef<HTMLFormElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  // Errors render far above the submit button on a phone: bring them into view.
  useEffect(() => {
    if (!state.message) return;
    const field = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    const target = field ?? alertRef.current;
    target?.focus();
    target?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [state]);
  const v = state.values ?? {};
  const e = state.fieldErrors ?? {};
  const invalid = (key: string) => (e[key]?.length ? true : undefined);
  const describedBy = (key: string) => (e[key]?.length ? `${key}-error` : undefined);

  return (
    <form ref={formRef} action={action} className="space-y-7">
      {state.message && (
        <div
          ref={alertRef}
          tabIndex={-1}
          role="alert"
          className="rounded-xl border-2 border-red bg-red/10 px-4 py-3 font-semibold text-red"
        >
          {state.message}
          {state.link && (
            <>
              {" "}
              <Link href={state.link.href} className="underline underline-offset-4">
                {state.link.label}
              </Link>
            </>
          )}
        </div>
      )}

      {/* Which date this form is for, so a form left open past closing time
          isn't quietly moved to the next one. */}
      <input type="hidden" name="edition" value={edition} />

      {/* Honeypot */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div>
        <Label htmlFor="name">Your name</Label>
        <input
          id="name"
          name="name"
          className="field"
          autoComplete="name"
          required
          minLength={2}
          maxLength={80}
          defaultValue={v.name}
          aria-invalid={invalid("name")}
          aria-describedby={describedBy("name")}
          placeholder="What should we call you?"
        />
        <FieldError id="name-error" errors={e.name} />
      </div>

      <div className="grid gap-7 sm:grid-cols-2 sm:gap-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <input
            id="email"
            name="email"
            type="email"
            className="field"
            autoComplete="email"
            required
            defaultValue={v.email}
            aria-invalid={invalid("email")}
            aria-describedby={describedBy("email")}
            placeholder="you@email.com"
          />
          <FieldError id="email-error" errors={e.email} />
        </div>
        <div>
          <Label htmlFor="phone">Mobile</Label>
          <input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            className="field"
            autoComplete="tel"
            required
            defaultValue={v.phone}
            aria-invalid={invalid("phone")}
            aria-describedby={describedBy("phone")}
            placeholder="9123 4567"
          />
          <FieldError id="phone-error" errors={e.phone} />
        </div>
      </div>

      {maxGuests > 0 ? (
        <fieldset>
          <legend className="mb-3 font-bold text-forest">
            Bringing friends?
            <span className="ml-2 text-sm font-normal text-muted">up to {maxGuests}</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {guestOptions(maxGuests).map((o) => (
              <label key={o.value} className="pill">
                <input
                  type="radio"
                  name="guests"
                  value={o.value}
                  defaultChecked={(v.guests || "0") === o.value}
                />
                <span>{o.label}</span>
              </label>
            ))}
          </div>
          <FieldError id="guests-error" errors={e.guests} />
        </fieldset>
      ) : (
        <input type="hidden" name="guests" value="0" />
      )}

      <fieldset>
        <legend className="mb-3 font-bold text-forest">
          Dietary needs
          {maxGuests > 0 && (
            <span className="ml-2 text-sm font-normal text-muted">for you and your friends</span>
          )}
        </legend>
        <div className="flex flex-wrap gap-2">
          {DIETARY_OPTIONS.map((o) => (
            <label key={o.value} className="pill">
              <input
                type="radio"
                name="dietary"
                value={o.value}
                required
                defaultChecked={(v.dietary || "none") === o.value}
              />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
        <FieldError id="dietary-error" errors={e.dietary} />
        <div className="mt-4">
          <Label htmlFor="dietaryNotes" hint="optional">
            Allergies or anything else we should know?
          </Label>
          <textarea
            id="dietaryNotes"
            name="dietaryNotes"
            rows={2}
            maxLength={300}
            className="field resize-y"
            defaultValue={v.dietaryNotes}
            aria-invalid={invalid("dietaryNotes")}
            placeholder={
              maxGuests > 0 ? "e.g. peanut allergy, one friend is vegetarian" : "e.g. peanut allergy"
            }
          />
          <FieldError id="dietaryNotes-error" errors={e.dietaryNotes} />
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-3 font-bold text-forest">
          How did you hear about Backyard?
          <span className="ml-2 text-sm font-normal text-muted">optional</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {HEARD_FROM_OPTIONS.map((o) => (
            <label key={o.value} className="pill">
              <input
                type="radio"
                name="heardFrom"
                value={o.value}
                defaultChecked={v.heardFrom === o.value}
              />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-3 rounded-2xl bg-cream/70 p-5">
        <label className="flex gap-3 text-[0.95rem] leading-snug">
          <input
            type="checkbox"
            name="consent"
            required
            defaultChecked={v.consent === "on"}
            className="mt-0.5 size-5 shrink-0 accent-forest"
            aria-invalid={invalid("consent")}
            aria-describedby={describedBy("consent")}
          />
          <span>
            I agree to {organiser} collecting and using my details to manage my
            registration and contact me about this event.
          </span>
        </label>
        <FieldError id="consent-error" errors={e.consent} />
        <label className="flex gap-3 text-[0.95rem] leading-snug text-muted">
          <input
            type="checkbox"
            name="marketingOptIn"
            defaultChecked={v.marketingOptIn === "on"}
            className="mt-0.5 size-5 shrink-0 accent-forest"
          />
          <span>Keep me posted about future Backyard events.</span>
        </label>
      </div>

      <button type="submit" disabled={pending} className="btn btn-primary w-full py-4 text-lg">
        {pending ? "Saving your spot…" : waitlist ? "Join the waitlist" : "Save my spot"}
        {!pending && <span aria-hidden="true">→</span>}
      </button>
    </form>
  );
}
