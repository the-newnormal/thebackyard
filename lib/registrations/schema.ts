import { z } from "zod";
import {
  OCCUPATIONS,
  RACES,
  RESIDENT_STATUSES,
  schoolsFor,
  SEXES,
} from "@/content/registration-options";
import { event } from "@/content/event";
import { birthdateProblem, dateIn } from "./birthdate";
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
        const problem = birthdateProblem(v, dateIn(event.timeZone));
        if (problem) ctx.addIssue({ code: "custom", message: problem });
      }),
    occupation: z.enum(OCCUPATIONS, "Pick one"),
    school: z.string().trim(),
    dietary: z.enum(dietaryValues, "Pick one"),
    dietaryNotes: optionalText(300),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .max(200, "That email is a bit long")
      .regex(EMAIL_PATTERN, "That email doesn’t look right"),
    phone: phoneSchema,
    // The PDPA question: may we keep them posted about future events?
    marketingOptIn: z.enum(["yes", "no"], "Pick one").transform((v) => v === "yes"),
    consent: z.literal("on", "We need your OK to hold your details for this event"),
  })
  // Only students are asked for a school, from the list for their occupation.
  .superRefine((v, ctx) => {
    const schools = schoolsFor(v.occupation);
    if (schools ? !schools.includes(v.school) : v.school !== "") {
      ctx.addIssue({ code: "custom", path: ["school"], message: "Pick your school" });
    }
  })
  .transform((v) => ({ ...v, school: v.school || null }));

export type RegistrationInput = z.infer<typeof registrationSchema>;
