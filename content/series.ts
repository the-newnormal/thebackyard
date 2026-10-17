// Backyard happens every month. What stays the same from month to month lives
// here; each month's date, venue, capacity and poster ("editions") are managed
// from /admin/editions.

export const series = {
  name: "Backyard Community BBQ",
  shortName: "Community BBQ",
  tagline: ["good food", "great vibes", "your community"],

  // Singapore has no daylight saving, so every edition is at +08:00.
  timeZone: "Asia/Singapore",
  utcOffset: "+08:00",

  // Named in the personal-data consent on the registration form.
  organiser: "The New Normal",

  // Optional. Shown in the footer and FAQ when set.
  contact: {
    email: "contact@backyard.sg",
    instagram: "ourbackyardsg", // handle without the @
  },
};

/**
 * The first edition, created automatically in a new database so sign-ups made
 * before editions moved to the database keep their date, venue and capacity.
 */
export const FIRST_EDITION_SEED = {
  slug: "community-bbq-2026-10",
  status: "published",
  startsAt: "2026-10-30T18:30:00+08:00",
  endsAt: "2026-10-30T21:30:00+08:00",
  registrationOpensAt: null,
  registrationClosesAt: "2026-10-30T18:30:00+08:00",
  capacity: 80,
  maxGuests: 3,
  venue: {
    name: "*SCAPE Plaza",
    level: "Level 1",
    address: "2 Orchard Link, Singapore 237978",
    directions: "A short walk from Somerset MRT (NS23).",
    mapsUrl:
      "https://www.google.com/maps/search/?api=1&query=*SCAPE%2C%202%20Orchard%20Link%2C%20Singapore%20237978",
  },
  poster: { src: "/poster.webp", width: 900, height: 1125 },
  notice: null,
  calledOffNote: null,
} as const;
