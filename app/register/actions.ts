"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { isRegistrationOpen, registrable } from "@/lib/editions/select";
import type { Edition } from "@/lib/editions/types";
import { isEmailConfigured, sendConfirmationEmail } from "@/lib/email";
import { eventDateShort } from "@/lib/format";
import {
  allowSend,
  checkVerificationCode,
  createPhoneToken,
  isPhoneVerificationEnabled,
  readPhoneToken,
  sendVerificationCode,
} from "@/lib/phone-verification";
import { getStore, StoreNotConfiguredError } from "@/lib/registrations";
import type { Registration } from "@/lib/registrations/types";
import { isSingaporeNumber } from "@/lib/registrations/phone";
import { normalizePhone, phoneSchema, registrationSchema } from "@/lib/registrations/schema";

/** A date that is taking sign-ups, offered when the one being filled in isn't. */
export type OtherDate = { href: string; label: string; edition: string };

export type RegisterState = {
  message?: string;
  link?: OtherDate;
  fieldErrors?: Partial<Record<string, string[]>>;
};

const FIELDS = [
  "name",
  "residentStatus",
  "sex",
  "race",
  "birthdate",
  "occupation",
  "school",
  "schoolOther",
  "dietary",
  "dietaryNotes",
  "email",
  "phone",
  "consent",
  "marketingOptIn",
];

const CLOSED = "Registration has closed for this one — see you at the next Backyard!";
const RELOAD =
  "We’ve updated the sign-up form since you opened this page. Reload the page to register.";

// When a returning guest can't confirm their number, their pass is emailed
// again, at most once per 10 minutes each (per server instance).
const RESEND_AFTER_MS = 10 * 60 * 1000;
const resent = new Map<string, number>();

/** Whether the pass is in their inbox: sent now, or within the last 10 minutes. */
async function resendPass(registration: Registration, edition: Edition): Promise<boolean> {
  const now = Date.now();
  for (const [token, at] of resent) {
    if (now - at >= RESEND_AFTER_MS) resent.delete(token);
  }
  if (resent.has(registration.passToken)) return true;
  if (!(await sendConfirmationEmail(registration, edition))) return false;
  resent.set(registration.passToken, now);
  return true;
}

/**
 * The date a form signs up for: the one it names, or, for forms from before
 * dates had names, the soonest one taking sign-ups. Drafts are never named.
 */
async function signUpTarget(requested: string) {
  const editions = await getStore().listEditions();
  const now = new Date();
  const open = registrable(editions, now);
  const edition = requested
    ? editions.find((e) => e.slug === requested && e.status !== "draft")
    : open[0];
  return { edition, open, now };
}

/** Why a date isn't taking sign-ups, and the date that is, if any. */
function closed(edition: Edition | undefined, open: Edition[]): RegisterState {
  const next = open.find((e) => e.slug !== edition?.slug);
  return {
    message: !edition
      ? CLOSED
      : edition.status === "cancelled"
        ? `Sorry, ${eventDateShort(edition)} has been called off.`
        : `Registration for ${eventDateShort(edition)} has closed.`,
    link: next && {
      href: `/register?edition=${next.slug}`,
      label: `Register for ${eventDateShort(next)} instead →`,
      edition: next.slug,
    },
  };
}

function failed(error: unknown): RegisterState {
  console.error("Registration failed", error);
  return {
    message:
      error instanceof StoreNotConfiguredError
        ? "Registration isn’t set up yet (no database configured). Please let the organisers know."
        : "Something went wrong saving your registration. Please try again in a moment.",
  };
}

export async function register(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  // Bots fill every field; people never see this one.
  if (formData.get("website")) redirect("/");

  // A page opened before the step-by-step questions has none of them; its old
  // form couldn't show which answers are missing.
  if (!formData.has("residentStatus")) return { message: RELOAD };
  let target;
  try {
    target = await signUpTarget(String(formData.get("edition") ?? ""));
  } catch (error) {
    return failed(error);
  }
  const { edition, open, now } = target;
  if (!edition || !isRegistrationOpen(edition, now)) return closed(edition, open);

  const values = Object.fromEntries(
    FIELDS.map((key) => [key, String(formData.get(key) ?? "")]),
  );
  const parsed = registrationSchema.safeParse({ ...values, consent: values.consent || null });

  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      (fieldErrors[key] ??= []).push(issue.message);
    }
    return { message: "One of your answers needs another look.", fieldErrors };
  }

  const answers = parsed.data;
  // SG numbers are confirmed with a texted code when Twilio is set up.
  const needsCode = isPhoneVerificationEnabled() && isSingaporeNumber(answers.phone);
  // Opened before texted codes were switched on, so it never asked for one.
  if (needsCode && formData.get("verifyPhone") !== "on") return { message: RELOAD };
  const check = needsCode
    ? readPhoneToken(String(formData.get("phoneToken") ?? ""), answers.phone, answers.email, Date.now())
    : null;
  if (needsCode && !check) {
    return {
      message: "Please confirm your mobile number with the code we text you.",
      fieldErrors: { phone: ["Confirm this number with a texted code"] },
    };
  }

  const data = {
    name: answers.name,
    email: answers.email,
    phone: answers.phone,
    phoneVerified: check?.verified ?? false,
    residentStatus: answers.residentStatus,
    sex: answers.sex,
    race: answers.race,
    birthdate: answers.birthdate,
    occupation: answers.occupation,
    school: answers.school,
    // Everyone registers for themselves now.
    guests: 0,
    dietary: answers.dietary,
    dietaryNotes: answers.dietaryNotes,
    heardFrom: null,
    marketingOptIn: answers.marketingOptIn,
  };

  let result;
  try {
    result = await getStore().register({ ...data, eventSlug: edition.slug });
  } catch (error) {
    return failed(error);
  }

  // It closed (or was called off) between loading it and saving the sign-up.
  if (result.kind === "closed") return closed(edition, open);

  const { registration } = result;

  if (result.kind === "duplicate") {
    // Only hand the existing pass to someone who also knows the phone number,
    // and, when codes are on, got one: a skipped check proves nothing.
    const samePhone = normalizePhone(registration.phone) === data.phone;
    if (samePhone && (!needsCode || check?.verified)) {
      redirect(`/pass/${registration.passToken}?existing=1`);
    }
    // Their code couldn't be checked, so the pass goes to the email it was
    // registered with. The error sits on the phone question, which drops the
    // skipped check so a new code is sent next time.
    if (samePhone) {
      return {
        message: (await resendPass(registration, edition))
          ? `You’re already registered, so we’ve emailed your pass to ${registration.email}. Or confirm your number with a texted code to open it here.`
          : "You’re already registered. Confirm your number with a texted code to get your pass back.",
        fieldErrors: { phone: ["Confirm this number with a texted code"] },
      };
    }
    return {
      message: isEmailConfigured()
        ? "This email is already registered. Check your inbox for your pass, or use the mobile number you signed up with."
        : "This email is already registered. Use the mobile number you signed up with to get your pass back.",
      fieldErrors: { email: ["Already registered"] },
    };
  }

  after(() => sendConfirmationEmail(registration, edition));
  redirect(`/pass/${registration.passToken}?new=1`);
}

type PhoneCodeResult = {
  error?: string;
  /** Another date to register for, when this one stopped taking sign-ups. */
  link?: OtherDate;
  /** Set when the check is done, or skipped because Twilio couldn't be reached. */
  token?: string;
  skipped?: boolean;
};

const TOO_MANY = "That’s a lot of codes! Wait a few minutes, then try again.";

/** The check couldn't happen on Twilio's side, so let them register unconfirmed. */
const skip = (phone: string, email: string): PhoneCodeResult => ({
  token: createPhoneToken(phone, email, false, Date.now()),
  skipped: true,
});

/**
 * Texts a code to an SG number, when phone verification is switched on, while
 * `edition` (the date being registered for) is taking sign-ups.
 */
export async function sendPhoneCode(
  rawPhone: string,
  email: string,
  edition: string,
): Promise<PhoneCodeResult> {
  // Only forms that ask for a code call this; one opened before codes were
  // switched off would wait for a text that never comes.
  if (!isPhoneVerificationEnabled()) return { error: RELOAD };
  try {
    const target = await signUpTarget(String(edition));
    if (!target.edition || !isRegistrationOpen(target.edition, target.now)) {
      const { message, link } = closed(target.edition, target.open);
      return { error: message, link };
    }
  } catch (error) {
    return { error: failed(error).message };
  }
  const phone = phoneSchema.safeParse(String(rawPhone));
  if (!phone.success) return { error: phone.error.issues[0].message };
  if (!isSingaporeNumber(phone.data)) return { error: "We only text codes to Singapore numbers" };

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const allowed = allowSend(ip, Date.now());
  if (allowed === "visitor") return { error: TOO_MANY };
  // Lots of texts from everyone lately: send none, but don't turn them away.
  if (allowed === "busy") {
    console.warn("Texted codes skipped: this instance reached its send limit");
    return skip(phone.data, String(email));
  }

  switch (await sendVerificationCode(phone.data)) {
    case "sent":
      return {};
    case "invalid":
      return { error: "We can’t text that number. Check it’s a mobile number." };
    case "too-many":
      return { error: TOO_MANY };
    default:
      return skip(phone.data, String(email));
  }
}

/** Checks a texted code; a correct one returns a token for the registration. */
export async function checkPhoneCode(
  rawPhone: string,
  email: string,
  rawCode: string,
): Promise<PhoneCodeResult> {
  if (!isPhoneVerificationEnabled()) return {};
  const phone = phoneSchema.safeParse(String(rawPhone));
  if (!phone.success) return { error: phone.error.issues[0].message };
  const code = String(rawCode).replace(/\D/g, "");
  if (!/^\d{4,10}$/.test(code)) return { error: "Enter the code from the text" };

  switch (await checkVerificationCode(phone.data, code)) {
    case "approved":
      return { token: createPhoneToken(phone.data, String(email), true, Date.now()) };
    case "wrong":
      return { error: "That code isn’t right. Check the text and try again." };
    case "expired":
      return { error: "That code has expired. Send yourself a new one." };
    case "too-many":
      return { error: "Too many tries. Wait a few minutes, then send a new code." };
    default:
      return skip(phone.data, String(email));
  }
}
