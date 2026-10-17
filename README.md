# Backyard

*a shared home where we eat, serve and love*

The website and registration platform for Backyard, a free community BBQ that
happens every month. Each month is an **edition** (a "date" in the dashboard)
with its own date, venue, capacity, poster and guest list.

- **`/`**: landing page with the next date, the "Why Backyard" story, FAQ
- **`/register`**: free registration with guests, dietary needs and a waitlist
  when full, for whichever date is taking sign-ups (`?edition=<slug>` for a
  specific one)
- **`/pass/<token>`**: each guest's pass for their own date, with their check-in
  code, calendar links and a "release my spot" button. The link carries an
  unguessable token; the short check-in code is only for the check-in table
- **`/admin`**: organiser dashboard with headcount, dietary breakdown, search,
  check-in, waitlist and CSV export, per date (`?edition=<slug>`)
- **`/admin/editions`**: plan, publish, edit, call off and add posters to dates

Built with Next.js 16 (App Router, Cache Components), Tailwind CSS 4 and Postgres.

## Running Backyard each month

Everything about a date is managed from **`/admin/editions`**; no code changes
or redeploys:

1. **Plan next month** copies the latest date to the same slot next month (the
   last Friday stays the last Friday), with the same times, venue and limits.
   Its sign-ups open when the previous date's close, so people at the BBQ can
   sign up for the next one. Check the date, then **Save & publish** (or save a
   draft; drafts are never public).
2. **Upload the poster** on the date's page. Photos are shrunk in the browser,
   so any size works. Until there's a poster, the site shows a date card.
3. The homepage switches to the next date by itself once the current one ends
   (within about five minutes). The dashboard stays on tonight's date until
   the next morning, so check-in isn't interrupted.
4. On the night, the dashboard has **Close sign-ups now** / **Reopen sign-ups**.
   If it rains or the haze is bad, **Call it off** with a note: the homepage,
   sign-up page and passes say so, and registrations are kept in case it's
   back on. Guests aren't emailed, so post on Instagram too.

| What | Where |
| --- | --- |
| Date, time, venue, capacity, friends per person, sign-up window, poster, note for guests | `/admin/editions` |
| Name, tagline, organiser, contact | `content/series.ts` |
| "Why Backyard", "Why BBQs", "Our model", FAQ, brand line | `content/copy.ts` |
| Brand colours and fonts | `app/globals.css` (`@theme`) and `app/layout.tsx` |
| Link preview image | `app/opengraph-image.jpg` (1200×630) |

## Running locally

```bash
npm install
cp .env.example .env.local   # set ADMIN_PASSWORD at minimum
npm run dev
```

Without `DATABASE_URL`, data is saved in `.data/` (git-ignored): sign-ups in
`registrations.json`, dates in `editions.json` (starting with the first one) and
posters in `posters/`. Point `DATABASE_URL` at any Postgres to use the real
store; the `registrations`, `editions` and `posters` tables are created
automatically on first use.

## Deploying (Vercel)

1. Import this repo into Vercel.
2. Add a Postgres database (e.g. Neon from the Vercel Marketplace). It sets
   `DATABASE_URL`/`POSTGRES_URL` for you.
3. Set `ADMIN_PASSWORD` (12+ characters), `SESSION_SECRET` and
   `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` (each `openssl rand -base64 32`; the
   last keeps forms that were open during a redeploy working); optionally
   confirmation email (`GMAIL_USER` + `GMAIL_APP_PASSWORD`, or `RESEND_API_KEY`,
   plus `EMAIL_FROM`). See `.env.example`.
   Put the functions in the same region as the database (Project Settings →
   Functions → Region, e.g. `sin1` for a Singapore database).
4. Deploy. On Vercel the app refuses to fall back to the local file store, so a
   missing database shows up as an error instead of lost sign-ups. The homepage
   is prerendered from the database at build time; a deployment without a
   database (a preview, say) shows "next date coming soon".

## How registration works

- One registration per email per date. Re-submitting with the same email and
  phone shows the existing pass; a different phone gets an error, so nobody can
  pull up someone else's pass with just their email.
- Sign-ups are only accepted for a published date between its opening and
  closing times, checked when the form is submitted. Each form names its date,
  so a form left open past closing time is turned away instead of being moved
  to the next date.
- Capacity counts people (registrant + guests). Once it's reached, new sign-ups
  join the waitlist, and while anyone is waiting, freed spots stay with the
  waitlist instead of going to newcomers. In Postgres, sign-ups are serialised
  with an advisory lock, so two people can't both take the last spot.
- Guests can release their own spot from their pass. Re-registering afterwards
  issues a new pass link, so old links stop working.
- Organisers can check in confirmed guests, give a waitlisted guest a spot
  (which emails them, if email is set up), cancel, restore or permanently
  delete (for personal-data requests) from `/admin`. Once a date is over or
  called off, guests can't release their spot and nobody can be given one.
- The tables are created on first use with row-level security enabled and no
  policies, so on Supabase they aren't readable through the REST API; the app
  connects as the table owner.
- If email is configured (Gmail or Resend), a confirmation email with the pass
  link and the date in the subject goes out after each sign-up.
