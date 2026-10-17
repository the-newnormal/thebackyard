import { z } from "zod";
import { sgtInstant } from "./plan";
import type { EditionFields } from "./types";

const text = (max: number, label: string) =>
  z
    .string()
    .transform((v) => v.replace(/\r\n?/g, "\n").trim())
    .pipe(z.string().max(max, `${label} must be under ${max} characters`));

const optional = (max: number, label: string) => text(max, label).transform((v) => v || null);

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;
const LOCAL = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2})?$/;

/** A datetime-local value in Singapore time → ISO instant. */
const localInstant = (value: string) => {
  const [, date, time] = LOCAL.exec(value)!;
  return sgtInstant(date, time);
};

/** The edition form (EditionFormValues) → the fields saved on the edition. */
export const editionFormSchema = z
  .object({
    date: z.string().regex(DATE, "Pick a date"),
    startTime: z.string().regex(TIME, "Pick a start time"),
    endTime: z.string().regex(TIME, "Pick an end time"),
    opensAt: z.string().regex(new RegExp(`^$|${LOCAL.source}`), "Pick a date and time, or leave it empty"),
    closesAt: z.string().regex(LOCAL, "Pick when sign-ups close"),
    capacity: z
      .string()
      .trim()
      .regex(/^\d*$/, "Use a whole number, or leave it empty for no limit")
      .transform((v) => (v ? Number(v) : null))
      .pipe(
        z
          .number()
          .int()
          .min(1, "At least 1, or leave it empty for no limit")
          .max(1000, "That’s a lot of people — 1000 at most")
          .nullable(),
      ),
    maxGuests: z.coerce
      .number("Use a whole number")
      .int("Use a whole number")
      .min(0, "0 means no friends")
      .max(10, "10 friends at most"),
    venueName: text(120, "The venue name").pipe(z.string().min(1, "Where is it?")),
    venueLevel: optional(60, "The level"),
    venueAddress: text(200, "The address").pipe(z.string().min(1, "Add the address")),
    venueDirections: optional(300, "Directions"),
    venueMapsUrl: optional(500, "The Maps link").refine(
      (v) => v === null || /^https:\/\/\S+$/.test(v),
      "Paste the full link, starting with https://",
    ),
    notice: optional(500, "The note"),
  })
  .transform((v, ctx): Omit<EditionFields, "status" | "poster" | "calledOffNote"> => {
    const startsAt = sgtInstant(v.date, v.startTime);
    const endsAt = sgtInstant(v.date, v.endTime);
    const registrationOpensAt = v.opensAt ? localInstant(v.opensAt) : null;
    const registrationClosesAt = localInstant(v.closesAt);
    if (endsAt <= startsAt) {
      ctx.addIssue({ code: "custom", path: ["endTime"], message: "End after it starts (same day)" });
    }
    if (registrationClosesAt > endsAt) {
      ctx.addIssue({ code: "custom", path: ["closesAt"], message: "Close sign-ups by the end time" });
    }
    if (registrationOpensAt && registrationOpensAt >= registrationClosesAt) {
      ctx.addIssue({ code: "custom", path: ["opensAt"], message: "Open sign-ups before they close" });
    }
    return {
      startsAt,
      endsAt,
      registrationOpensAt,
      registrationClosesAt,
      capacity: v.capacity,
      maxGuests: v.maxGuests,
      venue: {
        name: v.venueName,
        level: v.venueLevel,
        address: v.venueAddress,
        directions: v.venueDirections,
        mapsUrl: v.venueMapsUrl,
      },
      notice: v.notice,
    };
  });
