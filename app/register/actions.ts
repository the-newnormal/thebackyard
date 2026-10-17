"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { isRegistrationOpen, registrable } from "@/lib/editions/select";
import type { Edition } from "@/lib/editions/types";
import { isEmailConfigured, sendConfirmationEmail } from "@/lib/email";
import { eventDateShort } from "@/lib/format";
import {
  checkVerificationCode,
  createPhoneToken,
  isPhoneVerificationEnabled,
  sendVerificationCode,
  verifyPhoneToken,
} from "@/lib/phone-verification";
import { getStore, StoreNotConfiguredError } from "@/lib/registrations";
import { normalizePhone, phoneSchema, registrationSchema } from "@/lib/registrations/schema";

export type RegisterState = {
  message?: string;
  /** Shown after the message, e.g. to the next open date. */
  link?: { href: string; label: string };
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
  "dietary",
  "dietaryNotes",
  "email",
  "phone",
  "marketingOptIn",
  "consent",
];

const CLOSED = "Registration has closed for this one — see you at the next Backyard!";

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
  if (!formData.has("residentStatus")) {
    return { message: "We’ve updated the sign-up form since you opened this page. Reload the page to register." };
  }

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
  const verifying = isPhoneVerificationEnabled();
  const phoneToken = String(formData.get("phoneToken") ?? "");
  if (verifying && !verifyPhoneToken(phoneToken, answers.phone, Date.now())) {
    return {
      message: "Please confirm your mobile number with the code we text you.",
      fieldErrors: { phone: ["Confirm this number with a texted code"] },
    };
  }

  const data = {
    name: answers.name,
    email: answers.email,
    phone: answers.phone,
    phoneVerified: verifying,
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
    // Only hand the existing pass to someone who also knows the phone number.
    if (normalizePhone(registration.phone) === data.phone) {
      redirect(`/pass/${registration.passToken}?existing=1`);
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

/**
 * Texts a code to the number, when phone verification is switched on, while
 * `edition` (the date being registered for) is taking sign-ups.
 */
export async function sendPhoneCode(
  rawPhone: string,
  edition: string,
): Promise<{ error?: string }> {
  if (!isPhoneVerificationEnabled()) return {};
  try {
    const target = await signUpTarget(String(edition));
    if (!target.edition || !isRegistrationOpen(target.edition, target.now)) {
      return { error: closed(target.edition, target.open).message };
    }
  } catch (error) {
    return { error: failed(error).message };
  }
  const phone = phoneSchema.safeParse(String(rawPhone));
  if (!phone.success) return { error: phone.error.issues[0].message };

  switch (await sendVerificationCode(phone.data)) {
    case "sent":
      return {};
    case "invalid":
      return { error: "We can’t text that number. Check it’s a mobile number." };
    case "too-many":
      return { error: "That’s a lot of codes! Wait a few minutes, then try again." };
    default:
      return { error: "We couldn’t send a code just now. Try again in a moment." };
  }
}

/** Checks a texted code; a correct one returns a token for the registration. */
export async function checkPhoneCode(
  rawPhone: string,
  rawCode: string,
): Promise<{ token?: string; error?: string }> {
  if (!isPhoneVerificationEnabled()) return {};
  const phone = phoneSchema.safeParse(String(rawPhone));
  if (!phone.success) return { error: phone.error.issues[0].message };
  const code = String(rawCode).replace(/\D/g, "");
  if (!/^\d{4,10}$/.test(code)) return { error: "Enter the code from the text" };

  switch (await checkVerificationCode(phone.data, code)) {
    case "approved":
      return { token: createPhoneToken(phone.data, Date.now()) };
    case "wrong":
      return { error: "That code isn’t right. Check the text and try again." };
    case "expired":
      return { error: "That code has expired. Send yourself a new one." };
    case "too-many":
      return { error: "Too many tries. Wait a few minutes, then send a new code." };
    default:
      return { error: "We couldn’t check that code just now. Try again in a moment." };
  }
}
