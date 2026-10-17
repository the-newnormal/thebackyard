# Backyard

*a shared home where we eat, serve and love*

The website and registration platform for Backyard, starting with the
**Community BBQ**: Fri 30 October, 6:30–9:30PM, \*SCAPE Plaza @ L1.

- **`/`**: landing page with the event details, the "Why Backyard" story, FAQ
- **`/register`**: free registration on a page of its own, one question per screen:
  name, residency, sex, race, date of birth, occupation (and school, for students),
  dietary needs, email, mobile (confirmed with a texted code when Twilio is set up)
  and the PDPA question. Unfinished answers are kept in the browser so people can
  pick up where they left off. A waitlist opens when it's full
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
| Date, time, venue, capacity, closing time, organiser, contact | `content/event.ts` |
| Answer options: residency, race, occupations, schools | `content/registration-options.ts` |
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
3. Set `ADMIN_PASSWORD` (12+ characters), `SESSION_SECRET` and
   `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` (each `openssl rand -base64 32`; the
   last keeps forms that were open during a redeploy working); optionally
   `EVENT_CAPACITY`, confirmation email (`GMAIL_USER` + `GMAIL_APP_PASSWORD`,
   or `RESEND_API_KEY`, plus `EMAIL_FROM`) and mobile verification
   (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`).
   See `.env.example`.
   Put the functions in the same region as the database (Project Settings →
   Functions → Region, e.g. `sin1` for a Singapore database).
4. Deploy. On Vercel the app refuses to fall back to the local file store, so a
   missing database shows up as an error instead of lost sign-ups.

## How registration works

- Everyone registers for themselves. The questions and their options come from
  the Registration Questions sheet; students are asked for their school from the
  list for their occupation (secondary, ITE, JC, poly or university).
- One registration per email per event. Re-submitting with the same email and
  phone shows the existing pass; a different phone gets an error, so nobody can
  pull up someone else's pass with just their email.
- With Twilio Verify set up, the mobile number is confirmed with a texted code
  before the registration goes through, and the dashboard marks it verified.
  Without it, numbers are only checked for format. In the Twilio console, limit
  Verify's SMS geo permissions to the countries you expect, to keep the cost of
  bogus sign-ups down.
- Capacity counts people (registrants, plus friends added on earlier sign-ups,
  when the form still offered that). Once it's reached, new sign-ups
  join the waitlist, and while anyone is waiting, freed spots stay with the
  waitlist instead of going to newcomers. In Postgres, sign-ups are serialised
  with an advisory lock, so two people can't both take the last spot.
- Guests can release their own spot from their pass. Re-registering afterwards
  issues a new pass link, so old links stop working.
- Organisers can check in confirmed guests, give a waitlisted guest a spot
  (which emails them, if email is set up), cancel, restore or permanently
  delete (for personal-data requests) from `/admin`.
- The `registrations` table is created on first use (and new columns added to an
  existing one) with row-level security enabled and no policies, so on Supabase it isn't readable through the REST
  API; the app connects as the table owner.
- If email is configured (Gmail or Resend), a confirmation email with the pass
  link goes out after each sign-up.
