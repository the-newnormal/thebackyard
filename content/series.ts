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

  // Shown in the footer.
  organiser: "The New Normal",
  // Optional. Shown in the footer as "Hosted by <organiser> with <coOrganiser>"
  // when set. This shows on every date; clear it when the partnership ends.
  coOrganiser: "*SCAPE",

  // Optional. Shown in the footer and FAQ when set.
  contact: {
    email: "contact@backyard.sg",
    instagram: "ourbackyardsg", // handle without the @
    // The Data Protection Officer in the Terms: for having details removed.
    // content/terms.ts spells it out too (clauses 13.4 and 24); change both.
    dpo: "dpo@backyard.sg",
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
