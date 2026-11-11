"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { offerHelp, type HelpState } from "@/app/pass/actions";
import { support } from "@/content/copy";

type Offer = { helpWith: string[] | null; helpNote: string | null };

/** The PayNow details for this pass, from content/paynow.ts on the server. */
export type PayNowDetails = {
  /** "8690 9862", or a UEN. */
  recipient: string;
  reference: string | null;
  /** This pass's QR image. */
  qr: string;
};

const OTHER = support.help.options[support.help.options.length - 1];
const QR_FILE = "backyard-paynow-qr.png";

/** "cooking, welcoming and “a DJ set”": what they offered, for the thank-you. */
function describe({ helpWith, helpNote }: Offer): string {
  const parts = (helpWith ?? []).map((o) =>
    o === OTHER ? (helpNote ? `“${helpNote}”` : "something else") : o.toLowerCase(),
  );
  return new Intl.ListFormat("en-GB", { type: "conjunction" }).format(parts);
}

/**
 * The PayNow QR, for scanning off another screen. Most passes are opened on a
 * phone, which can't scan itself, so the QR can also be saved (banking apps
 * scan from the photo library) or the number copied.
 */
function PayNow({ recipient, reference, qr }: PayNowDetails) {
  const [copy, setCopy] = useState<"idle" | "copied" | "failed">("idle");
  // Sharing failed (not cancelled): the button downloads instead. It waits
  // for a fresh tap, as the failed share may have used this one up.
  const [shareFailed, setShareFailed] = useState(false);
  const copyTimer = useRef<number | undefined>(undefined);
  // On phones, "Save" opens the share sheet, whose "Save Image" puts the QR in
  // Photos; a download would land in Files on iPhones, out of the banking
  // app's reach. Sharing must start in the tap itself, so the file is
  // fetched ahead.
  const qrFile = useRef<File | null>(null);
  useEffect(() => {
    if (!window.matchMedia("(pointer: coarse)").matches || !navigator.canShare) return;
    let live = true;
    fetch(qr)
      .then((r) => (r.ok ? r.blob() : null))
      .then((blob) => {
        if (!live || !blob) return;
        const file = new File([blob], QR_FILE, { type: "image/png" });
        if (navigator.canShare({ files: [file] })) qrFile.current = file;
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [qr]);
  useEffect(() => () => window.clearTimeout(copyTimer.current), []);

  const copyLabel =
    copy === "copied"
      ? support.give.copied
      : copy === "failed"
        ? support.give.copyFailed
        : `${support.give.copy} ${recipient}`;

  return (
    <div className="mt-6">
      <h3 className="font-bold text-forest">{support.give.heading}</h3>
      <p className="mt-1 text-muted">{support.give.body}</p>
      <div className="mt-3 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        {/* eslint-disable-next-line @next/next/no-img-element -- a generated PNG per pass; long-press saves it on phones */}
        <img
          src={qr}
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
            {reference && (
              <>
                {" "}
                {support.give.reference} <span className="font-semibold text-ink">{reference}</span>
              </>
            )}
            .
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={qr}
              download={QR_FILE}
              onClick={(e) => {
                const file = qrFile.current;
                if (!file) return;
                e.preventDefault();
                navigator.share({ files: [file] }).catch((err: unknown) => {
                  if (err instanceof DOMException && err.name === "AbortError") return;
                  qrFile.current = null;
                  setShareFailed(true);
                });
              }}
              className="btn btn-outline px-4 py-2 text-sm"
            >
              {shareFailed ? support.give.download : support.give.save}
            </a>
            <button
              type="button"
              onClick={() => {
                const done = (result: "copied" | "failed") => {
                  setCopy(result);
                  window.clearTimeout(copyTimer.current);
                  copyTimer.current = window.setTimeout(() => setCopy("idle"), 2500);
                };
                if (!navigator.clipboard) return done("failed");
                navigator.clipboard.writeText(recipient.replace(/\s/g, "")).then(
                  () => done("copied"),
                  () => done("failed"),
                );
              }}
              className="btn btn-outline px-4 py-2 text-sm"
            >
              {copyLabel}
            </button>
          </div>
          <p aria-live="polite" className="sr-only">
            {copy === "copied" ? `${recipient} copied` : copy === "failed" ? support.give.copyFailed : ""}
          </p>
          <p aria-live="polite" className="mt-2 text-sm text-muted empty:hidden">
            {shareFailed ? support.give.shareFailed : ""}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * "Chip in", under every pass: PayNow (when a number is set) and an offer to
 * help on the night, saved with this sign-up and changeable later.
 */
export function Support({
  passToken,
  offer,
  payNow,
}: {
  passToken: string;
  offer: Offer;
  payNow: PayNowDetails | null;
}) {
  const [state, dispatch, pending] = useActionState<HelpState, FormData>(
    offerHelp.bind(null, passToken),
    {},
  );
  // What's saved: the latest answer, else what the page loaded with.
  const saved = state.saved ?? offer;
  const [editing, setEditing] = useState(false);
  const [ticked, setTicked] = useState<string[]>(saved.helpWith ?? []);
  const [note, setNote] = useState(saved.helpNote ?? "");
  const [hint, setHint] = useState("");
  // The reply whose error the guest has moved on from (by editing or retrying).
  const [errorSeen, setErrorSeen] = useState<HelpState | null>(null);
  const clearErrors = () => {
    setHint("");
    setErrorSeen(state);
  };
  // A save closes the form and shows what's saved now.
  const [shownFor, setShownFor] = useState(state);
  if (shownFor !== state) {
    setShownFor(state);
    if (state.saved) {
      setEditing(false);
      setTicked(state.saved.helpWith ?? []);
      setNote(state.saved.helpNote ?? "");
    }
  }

  // Focus follows whatever replaced the control just used, so keyboard and
  // screen-reader users aren't dropped at the top of the page.
  const status = useRef<HTMLParagraphElement>(null);
  const firstBox = useRef<HTMLInputElement>(null);
  const changeButton = useRef<HTMLButtonElement>(null);
  const focusNext = useRef<"status" | "first" | "change" | null>(null);
  useEffect(() => {
    if (state.saved) focusNext.current = "status";
  }, [state]);
  useEffect(() => {
    const target = focusNext.current;
    focusNext.current = null;
    if (target === "status") status.current?.focus();
    if (target === "first") firstBox.current?.focus();
    if (target === "change") changeButton.current?.focus();
  });

  const showForm = editing || !saved.helpWith;
  const withdrawing = ticked.length === 0 && Boolean(saved.helpWith);
  const withdrawn = state.saved && !state.saved.helpWith;
  const error = hint || (state !== errorSeen ? state.error : undefined);

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

      {payNow && <PayNow {...payNow} />}

      <div className="mt-6">
        <h3 className="font-bold text-forest">{support.help.heading}</h3>
        {/* Always present, so what it says when a save lands is announced. */}
        <p
          ref={status}
          tabIndex={-1}
          aria-live="polite"
          className="mt-1 text-ink outline-none [overflow-wrap:anywhere] empty:hidden"
        >
          {!showForm
            ? `${support.help.thanks} ${describe(saved)}.`
            : withdrawn && ticked.length === 0
              ? support.help.withdrawn
              : ""}
        </p>
        {!showForm && (
          <button
            ref={changeButton}
            type="button"
            onClick={() => {
              setTicked(saved.helpWith ?? []);
              setNote(saved.helpNote ?? "");
              clearErrors();
              setEditing(true);
              focusNext.current = "first";
            }}
            className="mt-1 text-sm font-semibold text-forest underline underline-offset-4"
          >
            {support.help.change}
          </button>
        )}
        {showForm && (
          // Submitted by hand rather than through `action`, which resets the
          // form after a reply and would put the boxes back behind React.
          <form
            className="mt-1"
            onSubmit={(e) => {
              e.preventDefault();
              if (ticked.length === 0 && !saved.helpWith) {
                setHint(support.help.pickOne);
                return;
              }
              clearErrors();
              const answers = new FormData(e.currentTarget);
              startTransition(() => dispatch(answers));
            }}
          >
            <fieldset disabled={pending}>
              <legend className="text-muted">{support.help.body}</legend>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {support.help.options.map((option, i) => (
                  <label
                    key={option}
                    className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-forest/15 px-4 py-3 font-semibold text-ink has-[:checked]:border-forest has-[:checked]:bg-lime/30"
                  >
                    <input
                      ref={i === 0 ? firstBox : undefined}
                      type="checkbox"
                      name="helpWith"
                      value={option}
                      checked={ticked.includes(option)}
                      onChange={(e) => {
                        clearErrors();
                        setTicked((t) =>
                          e.target.checked ? [...t, option] : t.filter((o) => o !== option),
                        );
                      }}
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
                  disabled={pending}
                  maxLength={200}
                  value={note}
                  onChange={(e) => {
                    clearErrors();
                    setNote(e.target.value);
                  }}
                  placeholder="e.g. photography, music, clean-up"
                  className="field"
                />
              </label>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={pending}
                className="btn btn-primary px-5 py-3 text-sm"
              >
                {pending ? "Saving…" : withdrawing ? "Take back my offer" : support.help.button}
              </button>
              {editing && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setTicked(saved.helpWith ?? []);
                    setNote(saved.helpNote ?? "");
                    clearErrors();
                    setEditing(false);
                    focusNext.current = "change";
                  }}
                  className="text-sm font-semibold text-muted underline underline-offset-4 hover:text-forest"
                >
                  Cancel
                </button>
              )}
              {error && (
                <p role="alert" className="text-sm font-semibold text-red-ink">
                  {error}
                </p>
              )}
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
