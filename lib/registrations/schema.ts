import { z } from "zod";
import {
  OCCUPATIONS,
  RACES,
  RESIDENT_STATUSES,
  schoolsFor,
  SEXES,
} from "@/content/registration-options";
import { signUpConsent } from "@/content/copy";
import { series } from "@/content/series";
import { birthdateProblem, dateIn, isUnder18 } from "./birthdate";
import { EMAIL_PATTERN } from "./email";
import { normalizePhone, PHONE_PATTERN } from "./phone";
import { DIETARY_OPTIONS } from "./types";

export { normalizePhone };

const dietaryValues = DIETARY_OPTIONS.map((o) => o.value) as [
  (typeof DIETARY_OPTIONS)[number]["value"],
  ...(typeof DIETARY_OPTIONS)[number]["value"][],
];

const optionalText = (max: number) =>
  z
    .string()
    // Browsers count a newline as one character but submit it as \r\n.
    .transform((v) => v.replace(/\r\n?/g, "\n").trim())
    .pipe(z.string().max(max, `Keep it under ${max} characters`))
    .transform((v) => v || null);

export const phoneSchema = z
  .string()
  .trim()
  .transform(normalizePhone)
  .pipe(
    z.string().regex(PHONE_PATTERN, "Use an 8-digit SG number, or pick your country code"),
  );

export const registrationSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Tell us your name")
      .max(80, "That name is a bit long"),
    residentStatus: z.enum(RESIDENT_STATUSES, "Pick one"),
    sex: z.enum(SEXES, "Pick one"),
    race: z.string().refine((v) => RACES.includes(v), "Pick one"),
    birthdate: z
      .string()
      .trim()
      .superRefine((v, ctx) => {
        const problem = birthdateProblem(v, dateIn(series.timeZone));
        if (problem) ctx.addIssue({ code: "custom", message: problem });
      }),
    occupation: z.enum(OCCUPATIONS, "Pick one"),
    school: z.string().trim(),
    schoolOther: optionalText(100),
    dietary: z.enum(dietaryValues, "Pick one"),
    dietaryNotes: optionalText(300),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .max(200, "That email is a bit long")
      .regex(EMAIL_PATTERN, "That email doesn’t look right"),
    phone: phoneSchema,
    consent: z.literal("on", "We need your OK to hold your details for this event"),
    guardianConsent: z.string(),
  })
  // Only students are asked for a school, from the list for their occupation.
  .superRefine((v, ctx) => {
    const schools = schoolsFor(v.occupation);
    if (schools ? !schools.includes(v.school) : v.school !== "") {
      ctx.addIssue({ code: "custom", path: ["school"], message: "Pick your school" });
    }
  })
  // Under-18s sign up with a parent's or guardian's OK (Terms 2.2).
  .superRefine((v, ctx) => {
    if (isUnder18(v.birthdate, dateIn(series.timeZone)) && v.guardianConsent !== "on") {
      ctx.addIssue({
        code: "custom",
        path: ["guardianConsent"],
        message: signUpConsent.guardian.missing,
      });
    }
  })
  // A school under "Others" is saved by the name they gave it, if any.
  .transform(({ schoolOther, ...v }) => ({
    ...v,
    school: (v.school === "Others" && schoolOther) || v.school || null,
  }));

export type RegistrationInput = z.infer<typeof registrationSchema>;

/** What an organiser takes down from a walk-in: no number needed, unlike a sign-up. */
export const walkInSchema = z.object({
  name: z.string().trim().min(2, "Add their name").max(80, "That name is a bit long"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(200, "That email is a bit long")
    .regex(EMAIL_PATTERN, "That email doesn’t look right"),
  phone: z
    .string()
    .trim()
    .transform(normalizePhone)
    .refine(
      (v) => v === "" || PHONE_PATTERN.test(v),
      "Use an 8-digit SG number, or + and the country code",
    ),
  dietary: z.enum(dietaryValues, "Pick one"),
});
