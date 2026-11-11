"use client";

import { useActionState, useState } from "react";
import { offerHelp, type HelpState } from "@/app/pass/actions";
import { support } from "@/content/copy";
import { payNowRecipient, type PayNowTarget } from "@/lib/paynow";

type Offer = { helpWith: string[] | null; helpNote: string | null };

const OTHER = support.help.options[support.help.options.length - 1];

/** "cooking, welcoming and “a DJ set”": what they offered, for the thank-you. */
function describe({ helpWith, helpNote }: Offer): string {
  const parts = (helpWith ?? []).map((o) =>
    o === OTHER ? (helpNote ? `“${helpNote}”` : "something else") : o.toLowerCase(),
  );
  return new Intl.ListFormat("en-GB", { type: "conjunction" }).format(parts);
}

/**
 * The PayNow QR, for scanning off another screen. Most passes are opened on a
 * phone, which can't scan itself, so it can also be saved (bank apps scan
 * from the photo library) or paid by typing the number in.
 */
function PayNow({ target }: { target: PayNowTarget }) {
  const recipient = payNowRecipient(target);
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-6">
      <h3 className="font-bold text-forest">{support.give.heading}</h3>
      <p className="mt-1 text-muted">{support.give.body}</p>
      <div className="mt-3 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        {/* eslint-disable-next-line @next/next/no-img-element -- a generated PNG, already the size it's shown at; long-press saves it on phones */}
        <img
          src="/paynow-qr.png"
          width={176}
          height={176}
          alt={`PayNow QR code for ${recipient}`}
          className="size-44 shrink-0 rounded-xl border-2 border-forest/15 bg-white"
        />
        <div className="text-sm text-ink">
          <p>{support.give.scan}</p>
          <p className="mt-2 text-muted">
            {support.give.onPhone}{" "}
            <span className="font-semibold whitespace-nowrap text-ink tabular-nums">{recipient}</span>
            {target.reference && (
              <>
                {" "}
                {support.give.reference}{" "}
                <span className="font-semibold text-ink">{target.reference}</span>
              </>
            )}
            .
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href="/paynow-qr.png"
              download="backyard-paynow-qr.png"
              className="btn btn-outline px-4 py-2 text-sm"
            >
              {support.give.save}
            </a>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(recipient.replace(/\s/g, "")).then(
                  () => setCopied(true),
                  () => setCopied(false),
                );
              }}
              className="btn btn-outline px-4 py-2 text-sm"
            >
              {copied ? support.give.copied : `${support.give.copy} ${recipient}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * "Chip in", under the pass: PayNow (when a number is set) and an offer to
 * help on the night, saved with this sign-up.
 */
export function Support({ passToken, offer }: { passToken: string; offer: Offer }) {
  const [state, action, pending] = useActionState<HelpState, FormData>(
    offerHelp.bind(null, passToken),
    {},
  );
  // What's saved: the latest answer, else what the page loaded with.
  const saved = state.saved ?? offer;
  const [editing, setEditing] = useState(false);
  const [ticked, setTicked] = useState<string[]>(saved.helpWith ?? []);
  const [note, setNote] = useState(saved.helpNote ?? "");
  // A save closes the form; "Change" opens it on what's saved.
  const [shownFor, setShownFor] = useState(state);
  if (shownFor !== state) {
    setShownFor(state);
    if (state.saved) setEditing(false);
  }

  const showForm = editing || !saved.helpWith;
  const withdrawing = ticked.length === 0 && Boolean(saved.helpWith);

  return (
    <section
      aria-labelledby="support-title"
      className="mt-8 rounded-3xl border-2 border-forest/15 bg-card px-6 py-8 sm:px-10"
    >
      <p className="font-heading text-xs tracking-widest text-orange-ink uppercase">
        {support.kicker}
      </p>
      <h2 id="support-title" className="mt-1 font-brush text-4xl leading-none text-forest">
        {support.title}
      </h2>
      <p className="mt-3 text-ink">{support.body}</p>

      {support.give.paynow && <PayNow target={support.give.paynow} />}

      <div className="mt-6">
        <h3 className="font-bold text-forest">{support.help.heading}</h3>
        {showForm ? (
          <form action={action} className="mt-1">
            <fieldset>
              <legend className="text-muted">{support.help.body}</legend>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {support.help.options.map((option) => (
                  <label
                    key={option}
                    className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-forest/15 px-4 py-3 font-semibold text-ink has-[:checked]:border-forest has-[:checked]:bg-lime/30"
                  >
                    <input
                      type="checkbox"
                      name="helpWith"
                      value={option}
                      checked={ticked.includes(option)}
                      onChange={(e) =>
                        setTicked((t) =>
                          e.target.checked ? [...t, option] : t.filter((o) => o !== option),
                        )
                      }
                      className="size-5 shrink-0 accent-forest"
                    />
                    {option}
                  </label>
                ))}
              </div>
            </fieldset>
            {ticked.includes(OTHER) && (
              <label className="mt-3 block">
                <span className="mb-1 block text-sm font-bold text-forest">
                  {support.help.other}{" "}
                  <span className="font-normal text-muted">optional</span>
                </span>
                <input
                  name="helpNote"
                  maxLength={200}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. photography, music, clean-up"
                  className="field"
                />
              </label>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={pending || (ticked.length === 0 && !withdrawing)}
                className="btn btn-primary px-5 py-3 text-sm"
              >
                {pending ? "Saving…" : withdrawing ? "Take back my offer" : support.help.button}
              </button>
              {editing && (
                <button
                  type="button"
                  onClick={() => {
                    setTicked(saved.helpWith ?? []);
                    setNote(saved.helpNote ?? "");
                    setEditing(false);
                  }}
                  className="text-sm font-semibold text-muted underline underline-offset-4 hover:text-forest"
                >
                  Cancel
                </button>
              )}
              {state.error && (
                <p role="alert" className="text-sm font-semibold text-red">
                  {state.error}
                </p>
              )}
            </div>
          </form>
        ) : (
          <p role="status" className="mt-1 text-ink">
            {support.help.thanks} {describe(saved)}.{" "}
            <button
              type="button"
              onClick={() => {
                setTicked(saved.helpWith ?? []);
                setNote(saved.helpNote ?? "");
                setEditing(true);
              }}
              className="font-semibold text-forest underline underline-offset-4"
            >
              {support.help.change}
            </button>
          </p>
        )}
      </div>
    </section>
  );
}
