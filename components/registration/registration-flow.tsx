"use client";

import Link from "next/link";
import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import {
  checkPhoneCode,
  register,
  sendPhoneCode,
  type OtherDate,
  type RegisterState,
} from "@/app/register/actions";
import { pdpaConsent } from "@/content/copy";
import { series } from "@/content/series";
import {
  MAIN_RACES,
  MORE_RACES,
  OCCUPATIONS,
  RESIDENT_STATUSES,
  schoolsFor,
  SEXES,
} from "@/content/registration-options";
import { birthdateProblem, dateIn, parseBirthdate } from "@/lib/registrations/birthdate";
import { EMAIL_PATTERN } from "@/lib/registrations/email";
import {
  composePhone,
  isSingaporeNumber,
  normalizePhone,
  PHONE_PATTERN,
} from "@/lib/registrations/phone";
import { DIETARY_OPTIONS } from "@/lib/registrations/types";
import { Starburst } from "../shapes";
import { COUNTRIES } from "./countries";
import {
  BirthdateFields,
  ChoiceGrid,
  CountryPicker,
  ErrorText,
  isConfirmingText,
  LINK,
  SearchList,
} from "./fields";
import { progressKey } from "./progress";

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
  /** The school's name, when it's "Others". */
  schoolOther: string;
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
  schoolOther: "",
  dietary: "",
  dietaryNotes: "",
  email: "",
  phoneCountry: COUNTRIES[0].name,
  phoneLocal: "",
  marketingOptIn: "",
};

/**
 * The server's word on a number and email: confirmed with a texted code, or
 * let through unconfirmed because Twilio couldn't be reached. Never saved.
 */
type Verified = { phone: string; email: string; token: string };

type Progress = { step: StepKey; values: Values; savedAt: number };

// Unfinished answers stay in this browser for a few days at most, in case
// it's a shared one.
const RESUME_WITHIN_MS = 3 * 24 * 60 * 60 * 1000;
const RESEND_AFTER_SECONDS = 30;
/** Taps this soon after a question appears belong to the one before it. */
const TAP_SETTLE_MS = 400;

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
  schoolOther: "school",
  dietary: "dietary",
  dietaryNotes: "dietary",
  email: "email",
  phone: "phone",
};

/**
 * Whether the code step is in the list. Picking SG shows it up front; an SG
 * number pasted under another country is texted a code too.
 */
function offersCode(values: Values, verifyPhone: boolean): boolean {
  const phone = phoneOf(values);
  return verifyPhone && (phone.country.code === "+65" || isSingaporeNumber(phone.normalized));
}

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
    ...(offersCode(values, verifyPhone) ? (["code"] as const) : []),
    "pdpa",
  ];
}

/** Only SG numbers get a texted code. */
const needsCode = (values: Values, verifyPhone: boolean) =>
  verifyPhone && isSingaporeNumber(phoneOf(values).normalized);

const hasAnswers = (values: Values) =>
  (Object.keys(EMPTY) as (keyof Values)[]).some((key) => values[key] !== EMPTY[key]);

function phoneOf(values: Values) {
  const country = COUNTRIES.find((c) => c.name === values.phoneCountry) ?? COUNTRIES[0];
  const composed = composePhone(country.code, values.phoneLocal, country.digits);
  const normalized = normalizePhone(composed);
  const display = /^\d{8}$/.test(normalized)
    ? `+65 ${normalized.slice(0, 4)} ${normalized.slice(4)}`
    : composed;
  return { country, composed, normalized, display };
}

/** True while `verified` covers the number and email now entered, with time to spare. */
function isVerified(values: Values, verified: Verified | null): boolean {
  if (!verified || verified.phone !== phoneOf(values).normalized) return false;
  if (verified.email !== values.email.trim().toLowerCase()) return false;
  const expires = Number(verified.token.split(".")[0]) * 1000;
  return expires - Date.now() > 10 * 60 * 1000;
}

/** The line under each question, if it has one. */
function asideFor(step: StepKey, values: Values, verifyPhone: boolean): string | undefined {
  switch (step) {
    case "birthdate":
      return "we won’t tell anyone your age";
    case "occupation":
      return "pick the closest one";
    case "school":
      return "start typing to find it";
    case "dietary":
      return "we’ll make sure there’s something good on the grill for you";
    case "email":
      return "your pass goes here";
    case "phone":
      return offersCode(values, verifyPhone)
        ? "we’ll text you a code to check it’s you"
        : "so we can reach you on the day";
    case "code":
      return `we sent a code to ${phoneOf(values).display}`;
  }
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
      return birthdateProblem(iso, dateIn(series.timeZone));
    }
    case "dietary":
      if (!values.dietary) return "Pick one";
      return values.dietaryNotes.trim().length > 300 ? "Keep it under 300 characters" : null;
    case "email": {
      const email = values.email.trim();
      return EMAIL_PATTERN.test(email) && email.length <= 200
        ? null
        : "That email doesn’t look right";
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

function readSaved(key: string): string | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { savedAt } = JSON.parse(raw) as Partial<Progress>;
    if (typeof savedAt === "number" && Date.now() - savedAt < RESUME_WITHIN_MS) return raw;
    localStorage.removeItem(key);
    return null;
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
    return { step: saved.step, values, savedAt: saved.savedAt };
  } catch {
    return null;
  }
}

export function RegistrationFlow({
  edition,
  date,
  intro,
  waitlist,
  verifyPhone,
}: {
  /** Slug of the date being registered for. */
  edition: string;
  /** That date, e.g. "Fri 30 Oct". */
  date: string;
  /** The welcome screen, rendered on the server. */
  intro: React.ReactNode;
  waitlist: boolean;
  /** Whether a texted code confirms the mobile number (Twilio is set up). */
  verifyPhone: boolean;
}) {
  const key = progressKey(edition);
  const readProgress = useCallback(() => readSaved(key), [key]);
  const savedRaw = useSyncExternalStore(subscribe, readProgress, () => null);
  const saved = useMemo(() => parseProgress(savedRaw), [savedRaw]);
  const [resumeSettled, setResumeSettled] = useState(false);
  const [started, setStarted] = useState(false);
  const [burst, setBurst] = useState(false);

  const [step, setStep] = useState<StepKey>("name");
  const [direction, setDirection] = useState<1 | -1>(1);
  const [values, setValues] = useState<Values>(EMPTY);
  const [verified, setVerified] = useState<Verified | null>(null);
  const [errors, setErrors] = useState<Partial<Record<StepKey, string>>>({});
  const [notice, setNotice] = useState<{
    step: StepKey;
    text: string;
    link?: OtherDate;
    tone?: "info";
  } | null>(null);

  // A link to another date only changes the query, so this component stays.
  // Start that date at its welcome screen, which offers the answers back.
  const [shownFor, setShownFor] = useState(edition);
  if (shownFor !== edition) {
    setShownFor(edition);
    setStarted(false);
    setResumeSettled(false);
    setNotice(null);
    setErrors({});
  }

  const [code, setCode] = useState("");
  const [codeSentAt, setCodeSentAt] = useState(0);
  const [now, setNow] = useState(0);
  const [phoneBusy, startPhoneWork] = useTransition();
  const phoneInput = useRef<HTMLInputElement>(null);
  const codeInput = useRef<HTMLInputElement>(null);
  const startButton = useRef<HTMLButtonElement>(null);
  const pendingAdvance = useRef<number | undefined>(undefined);
  // A new question ignores taps briefly, so the second half of a double-tap
  // on the last one can't answer it unseen.
  const [settling, setSettling] = useState(false);
  const settleTimer = useRef<number | undefined>(undefined);

  const steps = stepsFor(values, verifyPhone);
  const index = Math.max(0, steps.indexOf(step));
  const phone = phoneOf(values);

  useEffect(() => {
    if (!started) return;
    const progress: Progress = { step, values, savedAt: Date.now() };
    try {
      if (hasAnswers(values)) localStorage.setItem(key, JSON.stringify(progress));
      else localStorage.removeItem(key);
    } catch {
      // Private mode or storage full: they just can't resume later.
    }
  }, [key, started, step, values]);

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
    window.clearTimeout(pendingAdvance.current);
    window.clearTimeout(settleTimer.current);
    setSettling(true);
    settleTimer.current = window.setTimeout(() => setSettling(false), TAP_SETTLE_MS);
    setDirection(dir);
    setStep(to);
    setNotice(null);
  }

  function next(from: StepKey = step, vals: Values = values, ver: Verified | null = verified) {
    const list = stepsFor(vals, verifyPhone);
    let to = list[list.indexOf(from) + 1];
    if (to === "code" && (!needsCode(vals, verifyPhone) || isVerified(vals, ver))) {
      to = list[list.indexOf("code") + 1];
    }
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
    // An edit after a tap (e.g. "Others" for race) cancels the move it started.
    window.clearTimeout(pendingAdvance.current);
    setValues((v) => ({ ...v, ...patch }));
    setErrors((e) => ({ ...e, [step]: undefined }));
  }

  /** Records a tapped answer, then moves on once the tap has shown. */
  function pick(patch: Partial<Values>) {
    const from = step;
    const vals = { ...values, ...patch };
    setValues(vals);
    setErrors((e) => ({ ...e, [from]: undefined }));
    // A change of mind before we move on replaces the first answer, and where it leads.
    window.clearTimeout(pendingAdvance.current);
    pendingAdvance.current = window.setTimeout(() => next(from, vals), 220);
  }

  function submitStep(e: React.FormEvent) {
    e.preventDefault();
    const problem = validate(step, values);
    if (problem) {
      setErrors((er) => ({ ...er, [step]: problem }));
      return;
    }
    if (step === "phone" && needsCode(values, verifyPhone) && !isVerified(values, verified)) {
      sendCode();
      return;
    }
    next();
  }

  /** Saves the server's verdict on the number and moves past the code step. */
  function passCodeStep(token: string, skipped: boolean | undefined) {
    const ver = { phone: phone.normalized, email: values.email.trim().toLowerCase(), token };
    setVerified(ver);
    next("code", values, ver);
    if (skipped) {
      const list = stepsFor(values, verifyPhone);
      setNotice({
        step: list[list.indexOf("code") + 1],
        text: "We couldn’t text you a code just now, so we’ve skipped that check.",
        tone: "info",
      });
    }
  }

  function sendCode() {
    const from = step;
    startPhoneWork(async () => {
      const result = await sendPhoneCode(phone.composed, values.email, edition);
      if (result.link) {
        setNotice({ step: from, text: result.error ?? "", link: result.link });
        return;
      }
      if (result.error) {
        setErrors((er) => ({ ...er, [from]: result.error }));
        return;
      }
      if (result.token) return passCodeStep(result.token, result.skipped);
      const sentAt = Date.now();
      setCodeSentAt(sentAt);
      setNow(sentAt);
      setCode("");
      setErrors((er) => ({ ...er, code: undefined }));
      if (from === "code") codeInput.current?.focus();
      else go("code", 1);
    });
  }

  function checkCode(entered: string) {
    startPhoneWork(async () => {
      const result = await checkPhoneCode(phone.composed, values.email, entered);
      if (result.error) {
        setErrors((er) => ({ ...er, code: result.error }));
        return;
      }
      if (result.token) passCodeStep(result.token, result.skipped);
      else next("code");
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
    setNotice(result.message ? { step: target, text: result.message, link: result.link } : null);
  }

  /** Keeps the answers for another date's form, before following a link to it. */
  function carryOver(to: string) {
    const progress: Progress = { step, values, savedAt: Date.now() };
    try {
      localStorage.setItem(progressKey(to), JSON.stringify(progress));
      localStorage.removeItem(key);
    } catch {
      // They'll answer again.
    }
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
    // A code is only typed right after it's sent, and a confirmed number isn't
    // saved, so anyone past the mobile question confirms it again.
    const savedStep = saved.step === "code" ? "phone" : saved.step;
    let to = list.includes(savedStep) ? savedStep : list[0];
    if (needsCode(saved.values, verifyPhone) && list.indexOf(to) > list.indexOf("phone")) {
      to = "phone";
    }
    setValues(saved.values);
    setResumeSettled(true);
    setStarted(true);
    go(to, 1);
  }

  function startFresh() {
    try {
      localStorage.removeItem(key);
    } catch {
      // Nothing to forget.
    }
    // Answers carried over from another date are still in memory.
    setValues(EMPTY);
    setVerified(null);
    setCode("");
    setResumeSettled(true);
  }

  const [, submitAction, submitting] = useActionState(
    async (prev: RegisterState, formData: FormData) => {
      const result = await register(prev, formData);
      showServerErrors(result);
      return result;
    },
    {},
  );

  if (!started) {
    return (
      <div className="relative isolate flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-4 py-14 text-center">
        {intro}
        <button
          ref={startButton}
          type="button"
          onClick={start}
          className="btn btn-primary mt-9 px-10 py-4 text-xl"
        >
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
          // Closing hands focus back to whatever had it before, which was nothing.
          onClosed={() => startButton.current?.focus()}
        />
      </div>
    );
  }

  const error = errors[step];
  const headingId = `${step}-question`;
  const errorId = `${headingId}-error`;
  const aside = asideFor(step, values, verifyPhone);
  const describedBy =
    [aside && `${headingId}-aside`, error && errorId].filter(Boolean).join(" ") || undefined;
  const field = {
    "aria-labelledby": headingId,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
  } as const;
  const banner = notice?.step === step && (
    <div
      role={notice.tone === "info" ? "status" : "alert"}
      className={`mb-6 rounded-xl px-4 py-3 font-semibold ${
        notice.tone === "info"
          ? "bg-mustard/30 text-ink"
          : "border-2 border-red bg-red/10 text-red-ink"
      }`}
    >
      {notice.text}
      {notice.link && (
        <>
          {" "}
          <Link
            href={notice.link.href}
            onClick={() => carryOver(notice.link!.edition)}
            className="underline underline-offset-4"
          >
            {notice.link.label}
          </Link>
        </>
      )}
    </div>
  );
  const canGoBack = index > 0;
  const tapProps = {
    id: headingId,
    kicker: KICKERS[step],
    aside,
    describedBy,
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
              autoCapitalize="words"
              enterKeyHint="next"
              maxLength={80}
              value={values.name}
              onChange={(e) => update({ name: e.target.value })}
              placeholder="e.g. Rachel Tan"
              className="field h-16 px-5 text-2xl"
            />
            <ErrorText id={errorId}>{error}</ErrorText>
            <Nav onBack={canGoBack ? back : undefined} />
          </form>
        );

      case "residentStatus":
        return (
          <TapStep
            {...tapProps}
            question="what’s your residency status?"
            options={RESIDENT_STATUSES}
            value={values.residentStatus}
            onPick={(v) => pick({ residentStatus: v })}
          />
        );

      case "sex":
        return (
          <TapStep
            {...tapProps}
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
              describedBy={describedBy}
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
            <Question id={headingId} kicker={KICKERS[step]} aside={aside}>
              when were you born?
            </Question>
            {banner}
            <BirthdateFields
              value={values.birthdate}
              onChange={(birthdate) => update({ birthdate })}
              labelledBy={headingId}
              invalid={Boolean(error)}
              describedBy={describedBy}
            />
            <ErrorText id={errorId}>{error}</ErrorText>
            <Nav onBack={back} />
          </form>
        );

      case "occupation":
        return (
          <TapStep
            {...tapProps}
            question="what do you do?"
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
        return (
          <div>
            <Question id={headingId} kicker={KICKERS[step]} aside={aside}>
              which school do you go to?
            </Question>
            {banner}
            <SearchList
              label="Search schools"
              placeholder="Search schools"
              options={schools}
              value={values.school}
              // "Others" stays here to ask for the school's name.
              onPick={(v) => (v === "Others" ? update({ school: v }) : pick({ school: v }))}
              others={schools.includes("Others") ? "Others" : undefined}
            />
            {values.school === "Others" && (
              <div className="mt-6">
                <label
                  htmlFor={`${headingId}-other`}
                  className="mb-3 block font-serif text-xl text-muted italic"
                >
                  what’s it called? or just carry on.
                </label>
                <input
                  id={`${headingId}-other`}
                  autoFocus
                  autoCapitalize="words"
                  enterKeyHint="next"
                  maxLength={100}
                  value={values.schoolOther}
                  onChange={(e) => update({ schoolOther: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !isConfirmingText(e)) {
                      e.preventDefault();
                      next();
                    }
                  }}
                  placeholder="School name"
                  className="field h-16 px-5 text-2xl"
                />
              </div>
            )}
            <ErrorText id={errorId}>{error}</ErrorText>
            <Nav onBack={back} onNext={() => next()} hideNext={!values.school} />
          </div>
        );
      }

      case "dietary":
        return (
          <form onSubmit={submitStep} noValidate>
            <Question id={headingId} kicker={KICKERS[step]} aside={aside}>
              any dietary needs?
            </Question>
            {banner}
            <ChoiceGrid
              labelledBy={headingId}
              describedBy={describedBy}
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
            <Question id={headingId} kicker={KICKERS[step]} aside={aside}>
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
            <Question id={headingId} kicker={KICKERS[step]} aside={aside}>
              what’s your mobile number?
            </Question>
            {banner}
            <div className="flex gap-2">
              {/* The code goes to the number as sent, so it holds still till then. */}
              <CountryPicker
                value={phone.country}
                disabled={phoneBusy}
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
                // Ignored rather than read-only, which would drop the phone keyboard.
                onChange={(e) => !phoneBusy && update({ phoneLocal: e.target.value })}
                placeholder="9123 4567"
                className="field h-16 min-w-0 flex-1 px-5 text-2xl tabular-nums"
              />
            </div>
            {!isSingaporeNumber(phone.normalized) && /\d{4}/.test(values.phoneLocal) && (
              <p className="mt-3 text-muted">
                We’ll save it as <span className="font-semibold text-ink">{phone.composed}</span>
              </p>
            )}
            <ErrorText id={errorId}>{error}</ErrorText>
            <Nav
              onBack={back}
              pending={phoneBusy}
              nextLabel={
                needsCode(values, verifyPhone) && !isVerifiedNow() ? "Text me a code" : "Next"
              }
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
            <Question id={headingId} kicker={KICKERS[step]} aside={aside}>
              check your texts
            </Question>
            {banner}
            <input
              {...field}
              ref={codeInput}
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
                className={`${LINK} disabled:text-muted disabled:no-underline`}
              >
                {resendIn > 0 ? `Send again in ${resendIn}s` : "Send again"}
              </button>
              {" · "}
              <button
                type="button"
                disabled={phoneBusy}
                onClick={back}
                className={`${LINK} disabled:text-muted disabled:no-underline`}
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
            <p id={`${headingId}-pdpa`} className="-mt-3 mb-6 text-lg leading-relaxed text-ink">
              {pdpaConsent}
            </p>
            <ChoiceGrid
              labelledBy={headingId}
              describedBy={[`${headingId}-pdpa`, describedBy].filter(Boolean).join(" ")}
              options={[
                { value: "yes", label: "Yes" },
                { value: "no", label: "No" },
              ]}
              columns={2}
              value={values.marketingOptIn}
              onPick={(v) => update({ marketingOptIn: v })}
            />
            <ErrorText id={errorId}>{error}</ErrorText>

            <p className="mt-8 rounded-2xl bg-cream/70 p-5 text-[0.95rem] leading-snug text-ink">
              By registering, you agree to {series.organiser} collecting and using your details,
              in line with Singapore’s PDPA, to manage your registration, contact you about
              this event, and understand who Backyard reaches.
            </p>

            <Answers
              edition={edition}
              verifyPhone={verifyPhone}
              values={values}
              verified={verified}
            />
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
    return verified?.phone === phone.normalized && verified.email === values.email.trim().toLowerCase();
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
            {date.toLowerCase()}
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
        className={`flex-1 pt-9 pb-14 sm:pt-14 ${direction > 0 ? "animate-step-forward" : "animate-step-back"} ${settling ? "pointer-events-none" : ""}`}
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
  describedBy,
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
  describedBy?: string;
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
        describedBy={describedBy}
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
      {aside && (
        <p id={`${id}-aside`} className="mt-3 font-serif text-xl text-muted italic">
          {aside}
        </p>
      )}
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
function Answers({
  edition,
  verifyPhone,
  values,
  verified,
}: {
  edition: string;
  verifyPhone: boolean;
  values: Values;
  verified: Verified | null;
}) {
  const phone = phoneOf(values);
  const fields: Record<string, string> = {
    edition,
    name: values.name,
    residentStatus: values.residentStatus,
    sex: values.sex,
    race: values.race,
    birthdate: parseBirthdate(values.birthdate) ?? values.birthdate,
    occupation: values.occupation,
    school: schoolsFor(values.occupation) ? values.school : "",
    schoolOther:
      schoolsFor(values.occupation) && values.school === "Others" ? values.schoolOther : "",
    dietary: values.dietary,
    dietaryNotes: values.dietaryNotes,
    email: values.email,
    phone: phone.composed,
    phoneToken:
      verified?.phone === phone.normalized && verified.email === values.email.trim().toLowerCase()
        ? verified.token
        : "",
    // So the server can tell this form asked for a code.
    verifyPhone: verifyPhone ? "on" : "",
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
  onClosed,
}: {
  open: boolean;
  onContinue: () => void;
  onStartFresh: () => void;
  onClosed: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialog.current;
    if (open && d && !d.open) d.showModal();
    if (!open && d?.open) {
      d.close();
      onClosed();
    }
  }, [open, onClosed]);
  return (
    <dialog
      ref={dialog}
      aria-labelledby="resume-title"
      // Escape (which browsers don't always let us cancel) keeps their answers.
      onCancel={(e) => {
        e.preventDefault();
        onContinue();
      }}
      className="m-auto w-[min(92vw,26rem)] rounded-3xl border-2 border-forest bg-card p-7 text-center text-ink shadow-[8px_8px_0_var(--color-forest)] backdrop:bg-forest-deep/50 backdrop:backdrop-blur-sm"
    >
      <h2 id="resume-title" className="font-brush text-6xl leading-none text-forest">
        you’re back!
      </h2>
      <p className="mt-4 text-lg">Want to pick up where you left off?</p>
      <div className="mt-7 flex flex-col gap-3 sm:flex-row-reverse">
        <button type="button" onClick={onContinue} autoFocus className="btn btn-primary flex-1">
          Continue <span aria-hidden="true">→</span>
        </button>
        <button type="button" onClick={onStartFresh} className="btn btn-outline flex-1">
          Start fresh
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
