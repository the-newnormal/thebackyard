import { z } from "zod";
import { event } from "@/content/event";
import { normalizePhone } from "./phone";
import { DIETARY_OPTIONS, HEARD_FROM_OPTIONS } from "./types";

export { normalizePhone };

const dietaryValues = DIETARY_OPTIONS.map((o) => o.value) as [
  (typeof DIETARY_OPTIONS)[number]["value"],
  ...(typeof DIETARY_OPTIONS)[number]["value"][],
];
const heardFromValues = HEARD_FROM_OPTIONS.map((o) => o.value) as [
  (typeof HEARD_FROM_OPTIONS)[number]["value"],
  ...(typeof HEARD_FROM_OPTIONS)[number]["value"][],
];

const optionalText = (max: number) =>
  z
    .string()
    // Browsers count a newline as one character but submit it as \r\n.
    .transform((v) => v.replace(/\r\n?/g, "\n").trim())
    .pipe(z.string().max(max, `Keep it under ${max} characters`))
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
        // +65 numbers are normalised to 8 digits above; any left over are malformed.
        .regex(
          /^(\+(?!65)\d{8,15}|[3689]\d{7})$/,
          "Use an 8-digit SG number, or include your country code",
        ),
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
