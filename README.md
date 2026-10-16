# Backyard

*a shared home where we eat, serve and love*

The website and registration platform for Backyard, starting with the
**Community BBQ**: Fri 30 October, 6:30–9:30PM, \*SCAPE Plaza @ L1.

- **`/`**: landing page with the event details, the "Why Backyard" story, FAQ
- **`/register`**: free registration with guests, dietary needs and a waitlist when full
- **`/pass/CODE`**: each guest's pass with their check-in code, calendar links and a
  "release my spot" button
- **`/admin`**: organiser dashboard with headcount, dietary breakdown, search,
  check-in, waitlist and CSV export

Built with Next.js 16 (App Router, Cache Components), Tailwind CSS 4 and Postgres.

## Editing content

You don't need to touch components for most changes:

| What | Where |
| --- | --- |
| Date, time, venue, capacity, max guests, closing time, organiser, contact | `content/event.ts` |
| "Why Backyard", "Why BBQs", "Our model", FAQ, brand line | `content/copy.ts` |
| Brand colours and fonts | `app/globals.css` (`@theme`) and `app/layout.tsx` |
| Poster image (event details section) | `public/poster.webp` |
| Link preview image | `app/opengraph-image.jpg` (1200×630) |

For the next edition, change `slug` in `content/event.ts` so its sign-ups,
headcount and export start fresh.

## Running locally

```bash
npm install
cp .env.example .env.local   # set ADMIN_PASSWORD at minimum
npm run dev
```

Without `DATABASE_URL`, sign-ups are saved to `.data/registrations.json` (git-ignored).
Point `DATABASE_URL` at any Postgres to use the real store; the `registrations`
table is created automatically on first use.

## Deploying (Vercel)

1. Import this repo into Vercel.
2. Add a Postgres database (e.g. Neon from the Vercel Marketplace). It sets
   `DATABASE_URL`/`POSTGRES_URL` for you.
3. Set `ADMIN_PASSWORD` (and optionally `SESSION_SECRET`, `EVENT_CAPACITY`,
   `RESEND_API_KEY` + `EMAIL_FROM`). See `.env.example`.
4. Deploy. On Vercel the app refuses to fall back to the local file store, so a
   missing database shows up as an error instead of lost sign-ups.

## How registration works

- One registration per email per event. Re-submitting with the same email and
  phone shows the existing pass; a different phone gets an error, so nobody can
  pull up someone else's pass with just their email.
- Capacity counts people (registrant + guests). Once it's reached, new sign-ups
  join the waitlist. In Postgres, sign-ups are serialised with an advisory
  lock, so two people can't both take the last spot.
- Guests can release their own spot from their pass. Organisers can check in,
  give a waitlisted guest a spot, cancel, restore or permanently delete (for
  personal-data requests) from `/admin`.
- If Resend is configured, a confirmation email with the pass link goes out
  after each sign-up.
