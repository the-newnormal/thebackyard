# Backyard

*a shared home where we eat, serve and love*

The website and registration platform for Backyard, starting with the
**Community BBQ**: Fri 30 October, 6:30–9:30PM, \*SCAPE Plaza @ L1.

- **`/`**: landing page with the event details, the "Why Backyard" story, FAQ
- **`/register`**: free registration with guests, dietary needs and a waitlist when full
- **`/pass/<token>`**: each guest's pass with their check-in code, calendar links and
  a "release my spot" button. The link carries an unguessable token; the short
  check-in code on the pass is only for the check-in table
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
3. Set `ADMIN_PASSWORD` (12+ characters) and `SESSION_SECRET` (a long random
   value); optionally `EVENT_CAPACITY` and `RESEND_API_KEY` + `EMAIL_FROM`.
   See `.env.example`.
   Put the functions in the same region as the database (Project Settings →
   Functions → Region, e.g. `sin1` for a Singapore database).
4. Deploy. On Vercel the app refuses to fall back to the local file store, so a
   missing database shows up as an error instead of lost sign-ups.

## How registration works

- One registration per email per event. Re-submitting with the same email and
  phone shows the existing pass; a different phone gets an error, so nobody can
  pull up someone else's pass with just their email.
- Capacity counts people (registrant + guests). Once it's reached, new sign-ups
  join the waitlist, and while anyone is waiting, freed spots stay with the
  waitlist instead of going to newcomers. In Postgres, sign-ups are serialised
  with an advisory lock, so two people can't both take the last spot.
- Guests can release their own spot from their pass. Re-registering afterwards
  issues a new pass link, so old links stop working.
- Organisers can check in confirmed guests, give a waitlisted guest a spot
  (which emails them, if email is set up), cancel, restore or permanently
  delete (for personal-data requests) from `/admin`.
- The `registrations` table is created on first use with row-level security
  enabled and no policies, so on Supabase it isn't readable through the REST
  API; the app connects as the table owner.
- If Resend is configured, a confirmation email with the pass link goes out
  after each sign-up.
