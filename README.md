# Backyard

*a shared home where we eat, serve and love*

The website and registration platform for Backyard, a free community BBQ that
happens every month. Each month is an **edition** (a "date" in the dashboard)
with its own date, venue, capacity, poster and guest list.

- **`/`**: landing page with the next date, the "Why Backyard" story, FAQ
- **`/register`**: free registration on a page of its own, one question per screen:
  name, residency, sex, race, date of birth, postal code, occupation (and school, for students),
  dietary needs, email, mobile (confirmed with a texted code when Twilio is set up)
  and agreeing to the Terms (under-18s also tick that a parent or guardian agreed),
  for whichever date is taking sign-ups (`?edition=<slug>` for a specific one).
  Unfinished answers are kept in the browser, per date, so people can pick up
  where they left off. A waitlist opens when it's full
- **`/terms`**: the Terms and Conditions, with the Data Protection Notice, linked
  from the consent on the last sign-up step
- **`/pass/<token>`**: each guest's pass for their own date, with their check-in
  code, calendar links and a "release my spot" button. The link carries an
  unguessable token; the short check-in code is only for the check-in table
- **`/admin`**: organiser dashboard with headcount, dietary breakdown, search,
  check-in, waitlist and CSV export, per date (`?edition=<slug>`)
- **`/admin/editions`**: plan, publish, edit, call off and add posters to dates
- **`/admin/opt-outs`**: record people who emailed to stop getting updates, by
  email address or number; they're left out of "Want updates" and the CSV's
  `wants_updates` on every date until removed. Cancelling or releasing a spot
  doesn't take anyone off; deleting a sign-up does

Built with Next.js 16 (App Router, Cache Components), Tailwind CSS 4 and Postgres.

## Running Backyard each month

Everything about a date is managed from **`/admin/editions`**; no code changes
or redeploys:

1. **Plan next month** copies the latest date to the same slot in the next
   month without a date (the last Friday stays the last Friday), with the same
   times, venue and limits. Its sign-ups open when the date before it starts,
   so people at that BBQ can sign up for the next one. Check the date, then
   **Save & publish** (or save a draft; drafts are never public). There can
   only be one date per day.
2. **Upload the poster** on the date's page. Photos are shrunk in the browser,
   so any size works. Until there's a poster, the site shows a date card.
3. The homepage switches to the next date by itself once the current one ends
   (within about five minutes). The dashboard stays on tonight's date until
   the next morning, so check-in isn't interrupted.
4. A few days before, **Email reminder** on the dashboard emails every
   confirmed guest their code and pass link, counting down to the date ("3
   DAYS TO GO!"). It sends each time it's pressed, so press it once.
5. On the night, the dashboard has **Close sign-ups now** / **Reopen sign-ups**.
   If it rains or the haze is bad, **Call it off** with a note: the homepage,
   sign-up page and passes say so, and registrations are kept in case it's
   back on. Guests aren't emailed, so post on Instagram too. For someone who
   didn't sign up, **Add a walk-in** (from the morning of the date, and after
   it, for names taken down on paper) adds them checked in, even if it's full.
   It asks their name, age, school and postal code; email and mobile are optional.
   Walk-ins only get updates if they say yes; they're marked in the list and
   the CSV's `walk_in`.

| What | Where |
| --- | --- |
| Date, time, venue, capacity, sign-up window, poster, note for guests | `/admin/editions` |
| Name, tagline, organiser, co-organiser, contact | `content/series.ts` |
| Answer options: residency, race, occupations, schools | `content/registration-options.ts` |
| "Why Backyard", "Why BBQs", "Our model", FAQ, brand line, sign-up consent | `content/copy.ts` |
| Terms and Conditions (`/terms`) | `content/terms.ts` |
| Brand colours and fonts | `app/globals.css` (`@theme`) and `app/layout.tsx` |
| Link preview image | `app/opengraph-image.jpg` (1200×630) |

## Running locally

```bash
npm install
cp .env.example .env.local   # set ADMIN_PASSWORD at minimum
npm run dev
```

Without `DATABASE_URL`, data is saved in `.data/` (git-ignored): sign-ups in
`registrations.json`, dates in `editions.json` (starting with the first one),
opt-outs in `opt-outs.json` and posters in `posters/`. Point `DATABASE_URL` at
any Postgres to use the real store; the `registrations`, `editions`, `posters`
and `marketing_opt_outs` tables are created automatically on first use.

## Deploying (Vercel)

1. Import this repo into Vercel.
2. Add a Postgres database (e.g. Neon from the Vercel Marketplace). It sets
   `DATABASE_URL`/`POSTGRES_URL` for you.
3. Set `ADMIN_PASSWORD` (12+ characters), `SESSION_SECRET` and
   `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` (each `openssl rand -base64 32`; the
   last keeps forms that were open during a redeploy working); optionally
   confirmation email (`GMAIL_USER` + `GMAIL_APP_PASSWORD`, or `RESEND_API_KEY`,
   plus `EMAIL_FROM`) and mobile verification (`TWILIO_ACCOUNT_SID`,
   `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`). See `.env.example`.
   Put the functions in the same region as the database (Project Settings →
   Functions → Region, e.g. `sin1` for a Singapore database).
4. Deploy. On Vercel the app refuses to fall back to the local file store, so a
   missing database shows up as an error instead of lost sign-ups. The homepage
   is prerendered from the database at build time; a deployment without a
   database (a preview, say) shows "next date coming soon".

## How registration works

- Everyone registers for themselves. The questions and their options come from
  the Registration Questions sheet; students (secondary, ITE, JC, poly or
  university) pick their school from one A-Z list of every school, or pick
  "Others" and type its name, which is saved as their school.
- Everyone gives a 6-digit Singapore postal code (sign-ups and walk-ins), saved
  as `postal_code`. The CSV exports it as `S018956`, so spreadsheets keep the
  leading 0. Sign-ups from before it was asked have none; a sign-up or walk-in
  form opened before then is asked to reload.
- One registration per email per date. Re-submitting with the same email and
  phone shows the existing pass; a different phone gets an error, so nobody can
  pull up someone else's pass with just their email.
- Sign-ups are only accepted for a published date between its opening and
  closing times, checked when the form is submitted. Each form names its date,
  so a form left open past closing time is turned away instead of being moved
  to the next date.
- With Twilio Verify set up, Singapore mobile numbers are confirmed with a
  texted code before the registration goes through, and the dashboard marks them
  verified. Numbers from other countries, and sign-ups made while Twilio can't be
  reached, go through unverified rather than being turned away. Without Twilio,
  numbers are only checked for format.
- Codes only go to Singapore numbers and are rate-limited per visitor, so
  scripted texts can't run up the bill. In the Twilio console, also set Verify's
  SMS geo permissions to Singapore only, keep Fraud Guard on, and add a usage
  alert.
- Capacity counts people (registrants, plus friends added on earlier sign-ups,
  when the form still offered that). Once it's reached, new sign-ups
  join the waitlist, and while anyone is waiting, freed spots stay with the
  waitlist instead of going to newcomers. Until the event starts, a spot that
  opens up (a guest releases theirs, an organiser cancels or deletes one, or
  the limit goes up) goes straight to whoever has waited longest, and they're
  emailed. Nobody is skipped: a party too big for the free spots holds up
  those behind it. In Postgres, everything that changes who's confirmed is
  serialised with a per-date advisory lock, so two people can't both take the
  last spot.
- Guests can release their own spot from their pass. Re-registering afterwards
  issues a new pass link, so old links stop working.
- Organisers can check in confirmed guests, give a waitlisted guest a spot
  out of turn (which emails them, if email is set up; when it's full, after a
  confirm, over the limit without raising it, so the sign-up form stays full),
  cancel, restore or permanently delete (for personal-data requests) from
  `/admin`. Once a date is over or called off, guests can't release their
  spot. A spot can still be given after the date (say, to someone waitlisted
  who came anyway), without an email; not on a called-off date.
- The tables are created on first use (and new columns added to existing ones)
  with row-level security enabled and no policies, so on Supabase they aren't
  readable through the REST API; the app connects as the table owner.
- If email is configured (Gmail or Resend), a confirmation email with the pass
  link and the date in the subject goes out after each sign-up. Reminders go
  out only when an organiser presses **Email reminder**.
