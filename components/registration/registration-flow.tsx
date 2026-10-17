"use client";

import Link from "next/link";
import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { checkPhoneCode, register, sendPhoneCode, type RegisterState } from "@/app/register/actions";
import { event } from "@/content/event";
import {
  MAIN_RACES,
  MORE_RACES,
  OCCUPATIONS,
  RESIDENT_STATUSES,
  schoolsFor,
  SEXES,
} from "@/content/registration-options";
import {
  birthdateForInput,
  birthdateProblem,
  dateIn,
  formatBirthdateInput,
  parseBirthdate,
} from "@/lib/registrations/birthdate";
import { composePhone, normalizePhone, PHONE_PATTERN } from "@/lib/registrations/phone";
import { DIETARY_OPTIONS } from "@/lib/registrations/types";
import { Starburst } from "../shapes";
import { COUNTRIES } from "./countries";
import { ChoiceGrid, CountryPicker, ErrorText, SearchList } from "./fields";
import { PROGRESS_KEY } from "./progress";

// One question per screen, in the order of the Registration Questions sheet:
// about you, what you do (and school, for students), food, contact, PDPA.

type StepKey =
  | "name"
  | "residentStatus"
  | "sex"
  | "race"
  | "birthdate"
  | "occupation"
  | "school"
  | "dietary"
  | "email"
  | "phone"
  | "code"
  | "pdpa";

type Values = {
  name: string;
  residentStatus: string;
  sex: string;
  race: string;
  /** As typed, DD/MM/YYYY. */
  birthdate: string;
  occupation: string;
  school: string;
  dietary: string;
  dietaryNotes: string;
  email: string;
  /** A country name rather than its code, since +1 is shared. */
  phoneCountry: string;
  phoneLocal: string;
  /** The PDPA answer, "yes" or "no". */
  marketingOptIn: string;
};

const EMPTY: Values = {
  name: "",
  residentStatus: "",
  sex: "",
  race: "",
  birthdate: "",
  occupation: "",
  school: "",
  dietary: "",
  dietaryNotes: "",
  email: "",
  phoneCountry: COUNTRIES[0].name,
  phoneLocal: "",
  marketingOptIn: "",
};

/** A number confirmed with a texted code, and the server's proof of it. */
type Verified = { phone: string; token: string };

type Progress = { step: StepKey; values: Values; verified: Verified | null; savedAt: number };

const RESUME_WITHIN_MS = 7 * 24 * 60 * 60 * 1000;
const RESEND_AFTER_SECONDS = 30;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const KICKERS: Record<StepKey, string> = {
  name: "About you",
  residentStatus: "About you",
  sex: "About you",
  race: "About you",
  birthdate: "About you",
  occupation: "What you do",
  school: "What you do",
  dietary: "Food",
  email: "Staying in touch",
  phone: "Staying in touch",
  code: "Staying in touch",
  pdpa: "Last one",
};

/** Where a server-side error on each field should be fixed. */
const FIELD_STEP: Record<string, StepKey> = {
  name: "name",
  residentStatus: "residentStatus",
  sex: "sex",
  race: "race",
  birthdate: "birthdate",
  occupation: "occupation",
  school: "school",
  dietary: "dietary",
  dietaryNotes: "dietary",
  email: "email",
  phone: "phone",
};

function stepsFor(values: Values, verifyPhone: boolean): StepKey[] {
  return [
    "name",
    "residentStatus",
    "sex",
    "race",
    "birthdate",
    "occupation",
    ...(schoolsFor(values.occupation) ? (["school"] as const) : []),
    "dietary",
    "email",
    "phone",
    ...(verifyPhone ? (["code"] as const) : []),
    "pdpa",
  ];
}

function phoneOf(values: Values) {
  const country = COUNTRIES.find((c) => c.name === values.phoneCountry) ?? COUNTRIES[0];
  const composed = composePhone(country.code, values.phoneLocal);
  const normalized = normalizePhone(composed);
  const display = /^\d{8}$/.test(normalized)
    ? `+65 ${normalized.slice(0, 4)} ${normalized.slice(4)}`
    : composed;
  return { country, composed, normalized, display };
}

/** True while `verified` covers the number now entered, with time to spare. */
function isVerified(values: Values, verified: Verified | null): boolean {
  if (!verified || verified.phone !== phoneOf(values).normalized) return false;
  const expires = Number(verified.token.split(".")[0]) * 1000;
  return expires - Date.now() > 10 * 60 * 1000;
}

function validate(step: StepKey, values: Values): string | null {
  switch (step) {
    case "name": {
      const name = values.name.trim();
      if (name.length < 2) return "Tell us your name";
      return name.length > 80 ? "That name is a bit long" : null;
    }
    case "birthdate": {
      const iso = parseBirthdate(values.birthdate);
      if (!iso) return "That date doesn’t look right. Use DD/MM/YYYY";
      return birthdateProblem(iso, dateIn(event.timeZone));
    }
    case "dietary":
      if (!values.dietary) return "Pick one";
      return values.dietaryNotes.trim().length > 300 ? "Keep it under 300 characters" : null;
    case "email": {
      const email = values.email.trim();
      return EMAIL.test(email) && email.length <= 200 ? null : "That email doesn’t look right";
    }
    case "phone":
      return PHONE_PATTERN.test(phoneOf(values).normalized)
        ? null
        : phoneOf(values).country.code === "+65"
          ? "Use an 8-digit SG number"
          : "That number doesn’t look right";
    case "code":
      return null;
    case "pdpa":
      return values.marketingOptIn ? null : "Pick yes or no";
    default:
      return values[step] ? null : "Pick one";
  }
}

// Saved answers live in localStorage. Reading them through
// useSyncExternalStore keeps the server render (no answers) and the
// browser's (maybe some) from clashing.
const subscribe = (onChange: () => void) => {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
};

function readSaved(): string | null {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return null;
    const { savedAt } = JSON.parse(raw) as Partial<Progress>;
    return typeof savedAt === "number" && Date.now() - savedAt < RESUME_WITHIN_MS ? raw : null;
  } catch {
    return null;
  }
}

function parseProgress(raw: string | null): Progress | null {
  if (!raw) return null;
  try {
    const saved = JSON.parse(raw) as Progress;
    const values = { ...EMPTY };
    for (const key of Object.keys(EMPTY) as (keyof Values)[]) {
      if (typeof saved.values?.[key] === "string") values[key] = saved.values[key];
    }
    return { ...saved, values };
  } catch {
    return null;
  }
}

export function RegistrationFlow({
  intro,
  waitlist,
  verifyPhone,
}: {
  /** The welcome screen, rendered on the server. */
  intro: React.ReactNode;
  waitlist: boolean;
  /** Whether a texted code confirms the mobile number (Twilio is set up). */
  verifyPhone: boolean;
}) {
  const savedRaw = useSyncExternalStore(subscribe, readSaved, () => null);
  const saved = useMemo(() => parseProgress(savedRaw), [savedRaw]);
  const [resumeSettled, setResumeSettled] = useState(false);
  const [started, setStarted] = useState(false);
  const [burst, setBurst] = useState(false);

  const [step, setStep] = useState<StepKey>("name");
  const [direction, setDirection] = useState<1 | -1>(1);
  const [values, setValues] = useState<Values>(EMPTY);
  const [verified, setVerified] = useState<Verified | null>(null);
  const [errors, setErrors] = useState<Partial<Record<StepKey, string>>>({});
  const [notice, setNotice] = useState<{ step: StepKey; text: string } | null>(null);

  const [code, setCode] = useState("");
  const [codeSentAt, setCodeSentAt] = useState(0);
  const [now, setNow] = useState(0);
  const [phoneBusy, startPhoneWork] = useTransition();
  const phoneInput = useRef<HTMLInputElement>(null);

  const [, submitAction, submitting] = useActionState(
    async (prev: RegisterState, formData: FormData) => {
      const result = await register(prev, formData);
      showServerErrors(result);
      return result;
    },
    {},
  );

  const steps = stepsFor(values, verifyPhone);
  const index = Math.max(0, steps.indexOf(step));
  const phone = phoneOf(values);

  useEffect(() => {
    if (!started) return;
    const progress: Progress = { step, values, verified, savedAt: Date.now() };
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
    } catch {
      // Private mode or storage full: they just can't resume later.
    }
  }, [started, step, values, verified]);

  useEffect(() => {
    if (started) window.scrollTo({ top: 0 });
  }, [started, step]);

  // Counts down to "send again" on the code step.
  useEffect(() => {
    if (step !== "code") return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [step]);
  const resendIn = Math.max(0, Math.ceil(RESEND_AFTER_SECONDS - (now - codeSentAt) / 1000));

  function go(to: StepKey, dir: 1 | -1) {
    setDirection(dir);
    setStep(to);
    setNotice(null);
  }

  function next(from: StepKey = step, vals: Values = values) {
    const list = stepsFor(vals, verifyPhone);
    let to = list[list.indexOf(from) + 1];
    if (to === "code" && isVerified(vals, verified)) to = list[list.indexOf("code") + 1];
    if (to) go(to, 1);
  }

  function back() {
    const list = stepsFor(values, verifyPhone);
    let to = list[list.indexOf(step) - 1];
    // A code is only typed right after it's sent.
    if (to === "code") to = "phone";
    if (to) go(to, -1);
  }

  function update(patch: Partial<Values>) {
    setValues((v) => ({ ...v, ...patch }));
    setErrors((e) => ({ ...e, [step]: undefined }));
  }

  /** Records a tapped answer, then moves on once the tap has shown. */
  function pick(patch: Partial<Values>) {
    const from = step;
    const vals = { ...values, ...patch };
    setValues(vals);
    setErrors((e) => ({ ...e, [from]: undefined }));
    const list = stepsFor(vals, verifyPhone);
    const to = list[list.indexOf(from) + 1];
    window.setTimeout(() => {
      setDirection(1);
      setNotice(null);
      // Ignore a second tap that lands after we've already moved on.
      setStep((current) => (current === from ? to : current));
    }, 220);
  }

  function submitStep(e: React.FormEvent) {
    e.preventDefault();
    const problem = validate(step, values);
    if (problem) {
      setErrors((er) => ({ ...er, [step]: problem }));
      return;
    }
    if (step === "phone" && verifyPhone && !isVerified(values, verified)) {
      sendCode();
      return;
    }
    next();
  }

  function sendCode() {
    const from = step;
    startPhoneWork(async () => {
      const result = await sendPhoneCode(phone.composed);
      if (result.error) {
        setErrors((er) => ({ ...er, [from]: result.error }));
        return;
      }
      const sentAt = Date.now();
      setCodeSentAt(sentAt);
      setNow(sentAt);
      setCode("");
      setErrors((er) => ({ ...er, code: undefined }));
      if (from !== "code") go("code", 1);
    });
  }

  function checkCode(entered: string) {
    startPhoneWork(async () => {
      const result = await checkPhoneCode(phone.composed, entered);
      if (result.error) {
        setErrors((er) => ({ ...er, code: result.error }));
        return;
      }
      if (result.token) setVerified({ phone: phone.normalized, token: result.token });
      next("code");
    });
  }

  function showServerErrors(result: RegisterState) {
    const fieldErrors = Object.entries(result.fieldErrors ?? {});
    const byStep: Partial<Record<StepKey, string>> = {};
    for (const [field, messages] of fieldErrors) {
      const at = FIELD_STEP[field] ?? "pdpa";
      byStep[at] ??= messages?.[0];
    }
    // A rejected number needs a fresh code.
    if (byStep.phone) setVerified(null);
    const target = steps.find((s) => byStep[s]) ?? "pdpa";
    setErrors(byStep);
    if (target !== step) go(target, -1);
    setNotice(result.message ? { step: target, text: result.message } : null);
  }

  function start() {
    setResumeSettled(true);
    setStarted(true);
    go("name", 1);
    setBurst(true);
    window.setTimeout(() => setBurst(false), 1000);
  }

  function resume() {
    if (!saved) return;
    const list = stepsFor(saved.values, verifyPhone);
    let to = list.includes(saved.step) ? saved.step : list[0];
    if (to === "code") to = "phone";
    setValues(saved.values);
    setVerified(saved.verified ?? null);
    setResumeSettled(true);
    setStarted(true);
    go(to, 1);
  }

  function startFresh() {
    try {
      localStorage.removeItem(PROGRESS_KEY);
    } catch {
      // Nothing to forget.
    }
    setResumeSettled(true);
  }

  if (!started) {
    return (
      <div className="relative isolate flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-4 py-14 text-center">
        {intro}
        <button type="button" onClick={start} className="btn btn-primary mt-9 px-10 py-4 text-xl">
          {waitlist ? "Join the waitlist" : "Let’s go"} <span aria-hidden="true">→</span>
        </button>
        <p className="mt-4 text-muted">Takes about 2 minutes.</p>
        <Link
          href="/"
          className="mt-8 text-sm font-semibold text-muted underline underline-offset-4 hover:text-forest"
        >
          Back to home
        </Link>
        <ResumeDialog
          open={saved !== null && !resumeSettled}
          onContinue={resume}
          onStartFresh={startFresh}
        />
      </div>
    );
  }

  const error = errors[step];
  const headingId = `${step}-question`;
  const errorId = `${headingId}-error`;
  const field = {
    "aria-labelledby": headingId,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? errorId : undefined,
  } as const;
  const banner = notice?.step === step && (
    <div
      role="alert"
      className="mb-6 rounded-xl border-2 border-red bg-red/10 px-4 py-3 font-semibold text-red"
    >
      {notice.text}
    </div>
  );
  const canGoBack = index > 0;
  const tap = {
    id: headingId,
    kicker: KICKERS[step],
    banner,
    error,
    onBack: canGoBack ? back : undefined,
    onNext: () => next(),
  };

  function body() {
    switch (step) {
      case "name":
        return (
          <form onSubmit={submitStep} noValidate>
            <Question id={headingId} kicker={KICKERS[step]}>
              what’s your name?
            </Question>
            {banner}
            <input
              {...field}
              autoFocus
              autoComplete="name"
              enterKeyHint="next"
              maxLength={80}
              value={values.name}
              onChange={(e) => update({ name: e.target.value })}
              placeholder="e.g. rachel tan"
              className="field h-16 px-5 text-2xl"
            />
            <ErrorText id={errorId}>{error}</ErrorText>
            <Nav onBack={canGoBack ? back : undefined} />
          </form>
        );

      case "residentStatus":
        return (
          <TapStep
            {...tap}
            question="what’s your residency status?"
            options={RESIDENT_STATUSES}
            value={values.residentStatus}
            onPick={(v) => pick({ residentStatus: v })}
          />
        );

      case "sex":
        return (
          <TapStep
            {...tap}
            question="what’s your sex?"
            options={SEXES}
            columns={2}
            value={values.sex}
            onPick={(v) => pick({ sex: v })}
          />
        );

      case "race": {
        const other = values.race === "Others" || MORE_RACES.includes(values.race);
        return (
          <div>
            <Question id={headingId} kicker={KICKERS[step]}>
              what’s your race?
            </Question>
            {banner}
            <ChoiceGrid
              labelledBy={headingId}
              options={MAIN_RACES}
              columns={2}
              value={other ? "Others" : values.race}
              onPick={(v) => (v === "Others" ? update({ race: "Others" }) : pick({ race: v }))}
            />
            {other && (
              <div className="mt-6">
                <p className="mb-3 font-serif text-xl text-muted italic">
                  want to be more specific? search below, or just carry on.
                </p>
                <SearchList
                  autoFocus={false}
                  label="Search races"
                  placeholder="e.g. Filipino"
                  options={MORE_RACES}
                  value={values.race}
                  onPick={(v) => pick({ race: v })}
                />
              </div>
            )}
            <ErrorText id={errorId}>{error}</ErrorText>
            <Nav onBack={back} onNext={() => next()} hideNext={!values.race} />
          </div>
        );
      }

      case "birthdate":
        return (
          <form onSubmit={submitStep} noValidate>
            <Question id={headingId} kicker={KICKERS[step]} aside="we won’t tell anyone your age">
              when were you born?
            </Question>
            {banner}
            <input
              {...field}
              autoFocus
              inputMode="numeric"
              autoComplete="bday"
              enterKeyHint="next"
              value={values.birthdate}
              onChange={(e) => {
                const raw = e.target.value;
                const digits = raw.replace(/\D/g, "");
                // Autofill gives YYYY-MM-DD.
                if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return update({ birthdate: birthdateForInput(raw) });
                // Backspacing over a slash takes the digit before it too.
                const deletedSlash =
                  raw.length < values.birthdate.length &&
                  digits === values.birthdate.replace(/\D/g, "");
                update({
                  birthdate: formatBirthdateInput(deletedSlash ? digits.slice(0, -1) : digits),
                });
              }}
              placeholder="DD/MM/YYYY"
              className="field h-16 px-5 text-2xl tracking-wider tabular-nums"
            />
            <ErrorText id={errorId}>{error}</ErrorText>
            <Nav onBack={back} />
          </form>
        );

      case "occupation":
        return (
          <TapStep
            {...tap}
            question="what do you do?"
            aside="pick the closest one"
            options={OCCUPATIONS}
            columns={2}
            compact
            value={values.occupation}
            onPick={(v) =>
              pick({
                occupation: v,
                // A new occupation can mean a different list of schools.
                school: schoolsFor(v)?.includes(values.school) ? values.school : "",
              })
            }
          />
        );

      case "school": {
        const schools = schoolsFor(values.occupation) ?? [];
        if (schools.length <= 8) {
          return (
            <TapStep
            {...tap}
              question="which school do you go to?"
              options={schools}
              value={values.school}
              onPick={(v) => pick({ school: v })}
            />
          );
        }
        return (
          <div>
            <Question id={headingId} kicker={KICKERS[step]} aside="start typing to find it">
              which school do you go to?
            </Question>
            {banner}
            <SearchList
              label="Search schools"
              placeholder="Search schools"
              options={schools}
              value={values.school}
              onPick={(v) => pick({ school: v })}
              others={schools.includes("Others") ? "Others" : undefined}
            />
            <ErrorText id={errorId}>{error}</ErrorText>
            <Nav onBack={back} onNext={() => next()} hideNext={!values.school} />
          </div>
        );
      }

      case "dietary":
        return (
          <form onSubmit={submitStep} noValidate>
            <Question
              id={headingId}
              kicker={KICKERS[step]}
              aside="we’ll make sure there’s something good on the grill for you"
            >
              any dietary needs?
            </Question>
            {banner}
            <ChoiceGrid
              labelledBy={headingId}
              options={DIETARY_OPTIONS}
              columns={2}
              compact
              value={values.dietary}
              onPick={(v) => update({ dietary: v })}
            />
            <ErrorText id={errorId}>{error}</ErrorText>
            <label htmlFor="dietaryNotes" className="mt-7 mb-2 block font-bold text-forest">
              Allergies or anything else we should know?
              <span className="ml-2 text-sm font-normal text-muted">optional</span>
            </label>
            <textarea
              id="dietaryNotes"
              rows={2}
              maxLength={300}
              value={values.dietaryNotes}
              onChange={(e) => update({ dietaryNotes: e.target.value })}
              placeholder="e.g. peanut allergy"
              className="field resize-y"
            />
            <Nav onBack={back} />
          </form>
        );

      case "email":
        return (
          <form onSubmit={submitStep} noValidate>
            <Question id={headingId} kicker={KICKERS[step]} aside="your pass goes here">
              what’s your email?
            </Question>
            {banner}
            <input
              {...field}
              type="email"
              autoFocus
              autoComplete="email"
              autoCapitalize="none"
              enterKeyHint="next"
              maxLength={200}
              value={values.email}
              onChange={(e) => update({ email: e.target.value })}
              placeholder="e.g. rachel@gmail.com"
              className="field h-16 px-5 text-2xl"
            />
            <ErrorText id={errorId}>{error}</ErrorText>
            <Nav onBack={back} />
          </form>
        );

      case "phone":
        return (
          <form onSubmit={submitStep} noValidate>
            <Question
              id={headingId}
              kicker={KICKERS[step]}
              aside={
                verifyPhone
                  ? "we’ll text you a code to check it’s you"
                  : "so we can reach you on the day"
              }
            >
              what’s your mobile number?
            </Question>
            {banner}
            <div className="flex gap-2">
              <CountryPicker
                value={phone.country}
                onChange={(c) => {
                  update({ phoneCountry: c.name });
                  phoneInput.current?.focus();
                }}
              />
              <input
                {...field}
                ref={phoneInput}
                type="tel"
                autoFocus
                inputMode="tel"
                autoComplete="tel-national"
                enterKeyHint={verifyPhone ? "send" : "next"}
                maxLength={20}
                value={values.phoneLocal}
                onChange={(e) => update({ phoneLocal: e.target.value })}
                placeholder="e.g. 9123 4567"
                className="field h-16 min-w-0 flex-1 px-5 text-2xl tabular-nums"
              />
            </div>
            <ErrorText id={errorId}>{error}</ErrorText>
            <Nav
              onBack={back}
              pending={phoneBusy}
              nextLabel={verifyPhone && !isVerifiedNow() ? "Text me a code" : "Next"}
              pendingLabel="Sending…"
            />
          </form>
        );

      case "code":
        return (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!/^\d{4,10}$/.test(code)) {
                setErrors((er) => ({ ...er, code: "Enter the code from the text" }));
                return;
              }
              checkCode(code);
            }}
            noValidate
          >
            <Question id={headingId} kicker={KICKERS[step]} aside={`we sent a code to ${phone.display}`}>
              check your texts
            </Question>
            {banner}
            <input
              {...field}
              autoFocus
              inputMode="numeric"
              autoComplete="one-time-code"
              enterKeyHint="done"
              maxLength={10}
              value={code}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                setCode(digits);
                setErrors((er) => ({ ...er, code: undefined }));
                // Twilio codes are 6 digits unless the service says otherwise.
                if (digits.length === 6 && !phoneBusy) checkCode(digits);
              }}
              placeholder="123456"
              className="field h-16 px-5 text-center text-3xl tracking-[0.4em] tabular-nums"
            />
            <ErrorText id={errorId}>{error}</ErrorText>
            <p className="mt-4 text-muted">
              Didn’t get it?{" "}
              <button
                type="button"
                disabled={resendIn > 0 || phoneBusy}
                onClick={sendCode}
                className="font-semibold text-forest underline underline-offset-4 hover:text-orange-ink disabled:text-muted disabled:no-underline"
              >
                {resendIn > 0 ? `Send again in ${resendIn}s` : "Send again"}
              </button>
              {" · "}
              <button
                type="button"
                onClick={back}
                className="font-semibold text-forest underline underline-offset-4 hover:text-orange-ink"
              >
                Change number
              </button>
            </p>
            <Nav onBack={back} pending={phoneBusy} nextLabel="Confirm" pendingLabel="Checking…" />
          </form>
        );

      case "pdpa":
        return (
          <form
            action={submitAction}
            onSubmit={(e) => {
              const problem = validate("pdpa", values);
              if (problem) {
                e.preventDefault();
                setErrors((er) => ({ ...er, pdpa: problem }));
              }
            }}
          >
            <Question id={headingId} kicker={KICKERS[step]}>
              can we keep you posted?
            </Question>
            {banner}
            <p className="-mt-3 mb-6 text-lg leading-relaxed text-ink">
              Say yes and we’ll let you know about future Backyard events. Under the PDPA,
              we only use your details for Backyard and never share them. You can opt out
              anytime.
            </p>
            <ChoiceGrid
              labelledBy={headingId}
              options={[
                { value: "yes", label: "Yes!" },
                { value: "no", label: "Nope" },
              ]}
              columns={2}
              value={values.marketingOptIn}
              onPick={(v) => update({ marketingOptIn: v })}
            />
            <ErrorText id={errorId}>{error}</ErrorText>

            <p className="mt-8 rounded-2xl bg-cream/70 p-5 text-[0.95rem] leading-snug text-ink">
              By registering, you agree to {event.organiser} collecting and using your details
              to manage your registration and contact you about this event.
            </p>

            <Answers values={values} verified={verified} />
            <Nav
              onBack={back}
              pending={submitting}
              nextLabel={waitlist ? "Join the waitlist" : "Save my spot"}
              pendingLabel="Saving your spot…"
            />
          </form>
        );
    }
  }

  function isVerifiedNow() {
    return verified?.phone === phone.normalized;
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-xl flex-col px-4 sm:px-6">
      {burst && <Burst />}
      <header className="sticky top-0 z-20 -mx-4 border-b-2 border-forest/10 bg-paper/90 px-4 pt-4 pb-3 backdrop-blur-md sm:-mx-6 sm:px-6">
        <div className="flex items-baseline justify-between gap-4">
          <Link href="/" className="font-display text-2xl text-forest" aria-label="Backyard home">
            BACKYARD
          </Link>
          <span className="font-serif text-lg text-muted italic">
            {event.shortName.toLowerCase()}
          </span>
        </div>
        <div
          role="progressbar"
          aria-label="Registration progress"
          aria-valuemin={0}
          aria-valuemax={steps.length}
          aria-valuenow={index + 1}
          aria-valuetext={`Question ${index + 1} of ${steps.length}`}
          className="mt-3 h-2.5 overflow-hidden rounded-full bg-forest/10"
        >
          <div
            className="h-full rounded-full bg-orange transition-[width] duration-500 ease-out"
            style={{ width: `${((index + 1) / steps.length) * 100}%` }}
          />
        </div>
      </header>

      <div
        key={step}
        className={`flex-1 pt-9 pb-14 sm:pt-14 ${direction > 0 ? "animate-step-forward" : "animate-step-back"}`}
      >
        {body()}
      </div>
    </div>
  );
}

/** A tap-to-answer step: picking an answer moves on by itself. */
function TapStep({
  id,
  kicker,
  question,
  aside,
  banner,
  error,
  options,
  value,
  onPick,
  onBack,
  onNext,
  columns,
  compact,
}: {
  id: string;
  kicker: string;
  question: string;
  aside?: string;
  banner: React.ReactNode;
  error?: string;
  options: readonly string[];
  value: string;
  onPick: (value: string) => void;
  onBack?: () => void;
  onNext: () => void;
  columns?: 1 | 2;
  compact?: boolean;
}) {
  return (
    <div>
      <Question id={id} kicker={kicker} aside={aside}>
        {question}
      </Question>
      {banner}
      <ChoiceGrid
        labelledBy={id}
        options={options}
        columns={columns}
        compact={compact}
        value={value}
        onPick={onPick}
      />
      <ErrorText id={`${id}-error`}>{error}</ErrorText>
      {/* Coming back to an answered step: carry on without re-picking. */}
      <Nav onBack={onBack} onNext={onNext} hideNext={!value} />
    </div>
  );
}

function Question({
  id,
  kicker,
  aside,
  children,
}: {
  id: string;
  kicker: string;
  aside?: string;
  children: React.ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  // Without a text box to focus, start screen readers at the new question.
  useEffect(() => {
    if (document.activeElement === document.body) heading.current?.focus({ preventScroll: true });
  }, []);
  return (
    <div className="mb-8">
      <p className="font-heading text-xs tracking-widest text-orange-ink uppercase">{kicker}</p>
      <h1
        id={id}
        ref={heading}
        tabIndex={-1}
        className="mt-2 font-brush text-[clamp(2.75rem,11vw,4.25rem)] leading-[0.95] text-forest outline-none"
      >
        {children}
      </h1>
      {aside && <p className="mt-3 font-serif text-xl text-muted italic">{aside}</p>}
    </div>
  );
}

/** Back and Next. Holding the mouse down on them keeps the keyboard up on phones. */
function Nav({
  onBack,
  onNext,
  hideNext = false,
  nextLabel = "Next",
  pending = false,
  pendingLabel,
}: {
  onBack?: () => void;
  /** Without it, Next submits the step's form. */
  onNext?: () => void;
  hideNext?: boolean;
  nextLabel?: string;
  pending?: boolean;
  pendingLabel?: string;
}) {
  const keepFocus = (e: React.MouseEvent) => e.preventDefault();
  return (
    <div className="mt-9 flex gap-3">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          onMouseDown={keepFocus}
          disabled={pending}
          className="btn btn-outline px-5 py-4"
        >
          <span aria-hidden="true">←</span> Back
        </button>
      )}
      {!hideNext && (
        <button
          type={onNext ? "button" : "submit"}
          onClick={onNext}
          onMouseDown={keepFocus}
          disabled={pending}
          className="btn btn-primary flex-1 py-4 text-lg"
        >
          {pending && pendingLabel ? (
            pendingLabel
          ) : (
            <>
              {nextLabel} <span aria-hidden="true">→</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}

/** Every answer, as the registration action expects it. */
function Answers({ values, verified }: { values: Values; verified: Verified | null }) {
  const phone = phoneOf(values);
  const fields: Record<string, string> = {
    name: values.name,
    residentStatus: values.residentStatus,
    sex: values.sex,
    race: values.race,
    birthdate: parseBirthdate(values.birthdate) ?? values.birthdate,
    occupation: values.occupation,
    school: schoolsFor(values.occupation) ? values.school : "",
    dietary: values.dietary,
    dietaryNotes: values.dietaryNotes,
    email: values.email,
    phone: phone.composed,
    phoneToken: verified?.phone === phone.normalized ? verified.token : "",
    marketingOptIn: values.marketingOptIn,
    consent: "on",
  };
  return (
    <>
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {/* Honeypot */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
    </>
  );
}

function ResumeDialog({
  open,
  onContinue,
  onStartFresh,
}: {
  open: boolean;
  onContinue: () => void;
  onStartFresh: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialog.current;
    if (open && d && !d.open) d.showModal();
    if (!open && d?.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={dialog}
      aria-labelledby="resume-title"
      // Escape shouldn't skip the question.
      onCancel={(e) => e.preventDefault()}
      className="m-auto w-[min(92vw,26rem)] rounded-3xl border-2 border-forest bg-card p-7 text-center text-ink shadow-[8px_8px_0_var(--color-forest)] backdrop:bg-forest-deep/50 backdrop:backdrop-blur-sm"
    >
      <p className="font-serif text-xl text-muted italic">welcome back</p>
      <h2 id="resume-title" className="mt-1 font-brush text-6xl leading-none text-forest">
        you’re back!
      </h2>
      <p className="mt-4 text-lg">Want to pick up where you left off?</p>
      <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row">
        <button type="button" onClick={onStartFresh} className="btn btn-outline flex-1">
          Start fresh
        </button>
        <button type="button" onClick={onContinue} autoFocus className="btn btn-primary flex-1">
          Continue <span aria-hidden="true">→</span>
        </button>
      </div>
    </dialog>
  );
}

/** Starbursts popping as registration starts. Invisible without motion. */
function Burst() {
  const shape = "absolute opacity-0 animate-burst";
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center"
    >
      <Starburst color="var(--color-orange)" scribble={false} className={`${shape} w-[80vmin]`} />
      <Starburst
        variant={1}
        color="var(--color-lime)"
        scribble={false}
        className={`${shape} w-[55vmin] [animation-delay:90ms]`}
      />
      <Starburst
        variant={2}
        color="var(--color-mustard)"
        scribble={false}
        className={`${shape} w-[30vmin] [animation-delay:180ms]`}
      />
    </div>
  );
}
