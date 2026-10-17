"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { isRegistrationOpen, registrable } from "@/lib/editions/select";
import type { Edition } from "@/lib/editions/types";
import { isEmailConfigured, sendConfirmationEmail } from "@/lib/email";
import { eventDateShort } from "@/lib/format";
import { getStore, StoreNotConfiguredError } from "@/lib/registrations";
import { normalizePhone, registrationSchema } from "@/lib/registrations/schema";

export type RegisterState = {
  message?: string;
  /** Shown after the message, e.g. to the next open date. */
  link?: { href: string; label: string };
  fieldErrors?: Partial<Record<string, string[]>>;
  values?: Record<string, string>;
};

// Echoed back on errors so the form keeps what people typed.
const FIELDS = [
  "name",
  "email",
  "phone",
  "guests",
  "dietary",
  "dietaryNotes",
  "heardFrom",
  "consent",
  "marketingOptIn",
];

export async function register(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  // Bots fill every field; people never see this one.
  if (formData.get("website")) redirect("/");

  const values = Object.fromEntries(
    FIELDS.map((key) => [key, String(formData.get(key) ?? "")]),
  );
  const failed = (error: unknown): RegisterState => {
    console.error("Registration failed", error);
    return {
      message:
        error instanceof StoreNotConfiguredError
          ? "Registration isn’t set up yet (no database configured). Please let the organisers know."
          : "Something went wrong saving your registration. Please try again in a moment.",
      values,
    };
  };

  // Forms opened before editions existed have no edition field; they can only
  // have been for the one that's open now.
  const requested = String(formData.get("edition") ?? "");
  let editions: Edition[];
  try {
    editions = await getStore().listEditions();
  } catch (error) {
    return failed(error);
  }
  const now = new Date();
  const open = registrable(editions, now);
  const edition = requested
    ? editions.find((e) => e.slug === requested && e.status !== "draft")
    : open[0];
  const closed = (): RegisterState => {
    const next = open.find((e) => e.slug !== edition?.slug);
    return {
      message: !edition
        ? "Registration has closed for this one — see you at the next Backyard!"
        : edition.status === "cancelled"
          ? `Sorry, ${eventDateShort(edition)} has been called off.`
          : `Registration for ${eventDateShort(edition)} has closed.`,
      link: next && {
        href: `/register?edition=${next.slug}`,
        label: `Register for ${eventDateShort(next)} instead →`,
      },
      values,
    };
  };
  if (!edition || !isRegistrationOpen(edition, now)) return closed();

  const parsed = registrationSchema(edition.maxGuests).safeParse({
    ...values,
    heardFrom: values.heardFrom || null,
    consent: values.consent || null,
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      (fieldErrors[key] ??= []).push(issue.message);
    }
    return { message: "A few things need fixing below.", fieldErrors, values };
  }

  const { name, email, phone, guests, dietary, dietaryNotes, heardFrom, marketingOptIn } =
    parsed.data;
  const data = { name, email, phone, guests, dietary, dietaryNotes, heardFrom, marketingOptIn };

  let result;
  try {
    result = await getStore().register({ ...data, eventSlug: edition.slug });
  } catch (error) {
    return failed(error);
  }

  // It closed (or was called off) between loading it and saving the sign-up.
  if (result.kind === "closed") return closed();

  const { registration } = result;

  if (result.kind === "duplicate") {
    // Only hand the existing pass to someone who also knows the phone number.
    if (normalizePhone(registration.phone) === data.phone) {
      redirect(`/pass/${registration.passToken}?existing=1`);
    }
    return {
      message: isEmailConfigured()
        ? "This email is already registered. Check your inbox for your pass, or re-enter the mobile number you signed up with."
        : "This email is already registered. Re-enter the mobile number you signed up with to get your pass back.",
      fieldErrors: { email: ["Already registered"] },
      values,
    };
  }

  after(() => sendConfirmationEmail(registration, edition));
  redirect(`/pass/${registration.passToken}?new=1`);
}
