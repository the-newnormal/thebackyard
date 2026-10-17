"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { event } from "@/content/event";
import { isEmailConfigured, sendConfirmationEmail } from "@/lib/email";
import {
  checkVerificationCode,
  createPhoneToken,
  isPhoneVerificationEnabled,
  sendVerificationCode,
  verifyPhoneToken,
} from "@/lib/phone-verification";
import {
  getCapacity,
  getStore,
  isRegistrationOpen,
  StoreNotConfiguredError,
} from "@/lib/registrations";
import { normalizePhone, phoneSchema, registrationSchema } from "@/lib/registrations/schema";

export type RegisterState = {
  message?: string;
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

export async function register(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  // Bots fill every field; people never see this one.
  if (formData.get("website")) redirect("/");

  if (!isRegistrationOpen(new Date())) return { message: CLOSED };

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
    result = await getStore().register({ ...data, eventSlug: event.slug }, getCapacity());
  } catch (error) {
    console.error("Registration failed", error);
    return {
      message:
        error instanceof StoreNotConfiguredError
          ? "Registration isn’t set up yet (no database configured). Please let the organisers know."
          : "Something went wrong saving your registration. Please try again in a moment.",
    };
  }

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

  after(() => sendConfirmationEmail(registration));
  redirect(`/pass/${registration.passToken}?new=1`);
}

/** Texts a code to the number, when phone verification is switched on. */
export async function sendPhoneCode(rawPhone: string): Promise<{ error?: string }> {
  if (!isPhoneVerificationEnabled()) return {};
  if (!isRegistrationOpen(new Date())) return { error: CLOSED };
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
