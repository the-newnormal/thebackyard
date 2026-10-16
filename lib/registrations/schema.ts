import { z } from "zod";
import { event } from "@/content/event";
import { DIETARY_OPTIONS, HEARD_FROM_OPTIONS } from "./types";

const dietaryValues = DIETARY_OPTIONS.map((o) => o.value) as [
  (typeof DIETARY_OPTIONS)[number]["value"],
  ...(typeof DIETARY_OPTIONS)[number]["value"][],
];
const heardFromValues = HEARD_FROM_OPTIONS.map((o) => o.value) as [
  (typeof HEARD_FROM_OPTIONS)[number]["value"],
  ...(typeof HEARD_FROM_OPTIONS)[number]["value"][],
];

/** Strips spaces/dashes and a leading +65 so SG numbers compare equal. */
export function normalizePhone(input: string): string {
  const digits = input.replace(/[^\d+]/g, "");
  return digits.replace(/^\+?65(?=\d{8}$)/, "");
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep it under ${max} characters`)
    .transform((v) => v || null);

export const registrationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Tell us your name")
    .max(80, "That name is a bit long"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(200)
    .pipe(z.email("That email doesn’t look right")),
  phone: z
    .string()
    .trim()
    .transform(normalizePhone)
    .pipe(
      z
        .string()
        .regex(/^(\+\d{8,15}|[3689]\d{7})$/, "Use an 8-digit SG number, or include your country code"),
    ),
  guests: z.coerce
    .number()
    .int()
    .min(0)
    .max(event.maxGuests, `You can bring up to ${event.maxGuests} friends`),
  dietary: z.enum(dietaryValues, "Pick one"),
  dietaryNotes: optionalText(300),
  heardFrom: z.enum(heardFromValues).nullable().catch(null),
  consent: z.literal("on", "We need your OK to hold your details for this event"),
  marketingOptIn: z
    .string()
    .optional()
    .transform((v) => v === "on"),
});

export type RegistrationInput = z.infer<typeof registrationSchema>;
