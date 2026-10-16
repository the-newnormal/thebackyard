// Everything about the current Backyard event lives here.
// Change these values for the next edition — the site, registration form,
// calendar invite and admin dashboard all read from this file.

export const event = {
  // Stored on every registration. Use a new slug for each edition so
  // headcounts and exports stay separate.
  slug: "community-bbq-2026-10",
  name: "Backyard Community BBQ",
  shortName: "Community BBQ",
  tagline: ["free bbq", "great vibes", "community"],

  // ISO timestamps with the Singapore offset.
  startsAt: "2026-10-30T18:30:00+08:00",
  endsAt: "2026-10-30T21:30:00+08:00",
  timeZone: "Asia/Singapore",

  venue: {
    name: "*SCAPE Plaza",
    level: "Level 1",
    address: "2 Orchard Link, Singapore 237978",
    directions: "A short walk from Somerset MRT (NS23).",
    mapsUrl:
      "https://www.google.com/maps/search/?api=1&query=*SCAPE%2C%202%20Orchard%20Link%2C%20Singapore%20237978",
  },

  // Total headcount (registrants + their guests). Once reached, new sign-ups
  // join the waitlist. `null` means no cap. EVENT_CAPACITY overrides this.
  capacity: null as number | null,

  // How many friends one person can register alongside themselves.
  maxGuests: 3,

  // Registration closes automatically at this time.
  // Set REGISTRATION_OPEN=false to close it early.
  registrationClosesAt: "2026-10-30T18:30:00+08:00",

  // Named in the personal-data consent on the registration form.
  organiser: "The New Normal",

  // Optional. Shown in the footer and FAQ when set.
  contact: {
    email: "",
    instagram: "", // handle without the @
  },
};

export type BackyardEvent = typeof event;
