import "server-only";
import { createTransport } from "nodemailer";
import { series } from "@/content/series";
import type { Edition } from "./editions/types";
import {
  eventDateLong,
  eventDateShort,
  eventDayMonth,
  eventTimeRange,
  eventWeekday,
  firstName,
  venueLevelShort,
} from "./format";
import { dateIn } from "./registrations/birthdate";
import { editionDay } from "./registrations/demographics";
import { partySize, type Registration } from "./registrations/types";
import { siteUrl } from "./site";

// Optional emails (confirmations and reminders), sent through either:
// - Gmail / Google Workspace: GMAIL_USER (the mailbox you sign in to) and
//   GMAIL_APP_PASSWORD (an app password for it). EMAIL_FROM can name an alias
//   that mailbox may send as, e.g. "Backyard SG <contact@backyard.sg>".
// - Resend (https://resend.com): RESEND_API_KEY and EMAIL_FROM.
// Gmail is used when both are set. With neither, sending is a no-op.

/** First name for the greeting, unless it looks like a link someone typed in. */
function greetingName(name: string): string {
  const first = firstName(name);
  return /^[\p{L}\p{M}'’-]{1,30}$/u.test(first) ? first : "there";
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function gmailAccount() {
  const user = process.env.GMAIL_USER?.trim();
  // Google shows app passwords in groups of four; the spaces aren't part of it.
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, "");
  return user && pass ? { user, pass } : null;
}

export function isEmailConfigured(): boolean {
  return Boolean(gmailAccount() || (process.env.RESEND_API_KEY && process.env.EMAIL_FROM));
}

type Message = { to: string; subject: string; html: string; text: string };

/**
 * Sends through whichever provider is set up, or null if there's none. Gmail
 * keeps one connection until `close`, so a batch doesn't sign in for every
 * email; Resend gets half a second between emails, under its rate limit.
 * `send` resolves to whether the provider took the email; failures are only
 * logged.
 */
function mailer(label: string) {
  const gmail = gmailAccount();
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM?.trim() || gmail?.user;
  if (!from || (!gmail && !apiKey)) return null;

  if (gmail) {
    const transport = createTransport({
      pool: true,
      maxConnections: 1,
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: gmail,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
    return {
      async send(message: Message): Promise<boolean> {
        try {
          await transport.sendMail({ from, ...message });
          console.info(`${label} email sent via Gmail`);
          return true;
        } catch (error) {
          console.error(`${label} email failed (Gmail)`, error);
          return false;
        }
      },
      close: () => transport.close(),
    };
  }

  let nextAt = 0;
  return {
    async send(message: Message): Promise<boolean> {
      const wait = nextAt - Date.now();
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      nextAt = Date.now() + 500;
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ from, ...message }),
        });
        if (!response.ok) {
          console.error(`${label} email failed`, response.status, await response.text());
        }
        return response.ok;
      } catch (error) {
        console.error(`${label} email failed`, error);
        return false;
      }
    },
    close() {},
  };
}

/** The Backyard card every email sits in, under the tagline and wordmark. */
const page = (body: string) => `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#f4f1ea;padding:32px 16px;color:#1d2a20">
    <div style="max-width:520px;margin:0 auto;background:#fffdf7;border-radius:16px;padding:32px;border:2px solid #2f5b3b">
      <p style="margin:0 0 4px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#e88732;font-weight:700">${escapeHtml(series.tagline.join(" | "))}</p>
      <h1 style="margin:0 0 16px;font-size:30px;font-style:italic;font-weight:900;color:#2f5b3b">BACKYARD</h1>${body}
    </div>
  </div>`;

const noticeHtml = (edition: Edition) =>
  edition.notice
    ? `
      <p style="font-size:15px;line-height:1.5;background:#f3e2a9;border-radius:10px;padding:12px 14px"><strong>Heads up:</strong> ${escapeHtml(edition.notice)}</p>`
    : "";

const passButton = (passUrl: string) =>
  `<p style="margin:24px 0"><a href="${passUrl}" style="background:#2f5b3b;color:#f9ecd0;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:700">View your pass</a></p>`;

const passUrlFor = (registration: Registration) => `${siteUrl()}/pass/${registration.passToken}`;

function confirmationEmail(registration: Registration, edition: Edition): Message {
  const passUrl = passUrlFor(registration);
  const waitlisted = registration.status === "waitlist";
  const name = escapeHtml(greetingName(registration.name));
  const party = partySize(registration);
  const { venue } = edition;
  const where = `${venue.name}${venue.level ? ` (${venue.level})` : ""}, ${venue.address}`;
  const when = `${eventDateLong(edition)}, ${eventTimeRange(edition)}`;
  // The date keeps one month's email apart from the next in a busy inbox.
  const subject = `${waitlisted ? "You’re on the waitlist" : "You’re in"} — Backyard, ${eventDateShort(edition)} (${registration.code})`;

  const html = page(`
      <p style="font-size:17px;line-height:1.5">Hey ${name},</p>
      <p style="font-size:17px;line-height:1.5">${
        waitlisted
          ? "We’re at capacity right now, so you’re on the waitlist. If a spot opens up we’ll let you know."
          : `You’re in! We’ve saved ${party === 1 ? "a spot" : `${party} spots`} for you at the ${escapeHtml(series.shortName.toLowerCase())}.`
      }</p>${noticeHtml(edition)}
      <table style="width:100%;font-size:15px;line-height:1.5;margin:16px 0;border-collapse:collapse">
        <tr><td style="padding:6px 0;color:#6b6b5e;width:90px">When</td><td style="padding:6px 0"><strong>${escapeHtml(when)}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#6b6b5e">Where</td><td style="padding:6px 0"><strong>${escapeHtml(where)}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#6b6b5e">Code</td><td style="padding:6px 0"><strong style="font-family:monospace;font-size:18px;letter-spacing:.15em">${registration.code}</strong></td></tr>
      </table>
      ${passButton(passUrl)}
      <p style="font-size:14px;line-height:1.5;color:#6b6b5e">Plans changed? Open your pass and release your spot so someone else can come.</p>`);

  const text = [
    `Hey ${greetingName(registration.name)},`,
    waitlisted
      ? "We’re at capacity right now, so you’re on the waitlist. If a spot opens up we’ll let you know."
      : `You’re in! Party of ${party}.`,
    ...(edition.notice ? [`Heads up: ${edition.notice}`] : []),
    `When: ${when}`,
    `Where: ${where}`,
    `Code: ${registration.code}`,
    `Your pass: ${passUrl}`,
  ].join("\n\n");

  return { to: registration.email, subject, html, text };
}

/**
 * Confirms a sign-up (or a spot given from the waitlist) for its own edition.
 * Resolves to whether the provider took the email; failures are only logged.
 */
export async function sendConfirmationEmail(
  registration: Registration,
  edition: Edition,
): Promise<boolean> {
  const mail = registration.email ? mailer("Confirmation") : null;
  if (!mail) return false;
  try {
    return await mail.send(confirmationEmail(registration, edition));
  } finally {
    mail.close();
  }
}

/** How far off the date is, by the calendar in Singapore. */
function countdown(edition: Edition, now: Date) {
  const days = Math.round(
    (Date.parse(editionDay(edition)) - Date.parse(dateIn(series.timeZone, now))) / 86_400_000,
  );
  if (days <= 0) return { headline: "SEE YOU TONIGHT!", soon: "tonight", seeYou: "tonight" };
  if (days === 1) return { headline: "SEE YOU TOMORROW!", soon: "tomorrow", seeYou: "tomorrow" };
  return {
    headline: `${days} DAYS TO GO!`,
    soon: `in ${days} days`,
    seeYou: days < 7 ? `this ${eventWeekday(edition)}` : `on ${eventDayMonth(edition)}`,
  };
}

export type ReminderOptions = {
  /** No published date comes before this one. */
  first: boolean;
  now: Date;
};

function reminderEmail(
  registration: Registration,
  edition: Edition,
  { first, now }: ReminderOptions,
): Message {
  const passUrl = passUrlFor(registration);
  const name = greetingName(registration.name);
  const { venue } = edition;
  const level = venueLevelShort(venue.level);
  const where = `${venue.name}${level ? `, ${level}` : ""}`;
  const date = `${eventDayMonth(edition)} (${eventWeekday(edition)})`;
  const time = eventTimeRange(edition);
  const when = countdown(edition, now);
  const opening = `Coming through with a friendly reminder: Backyard opens for ${
    first ? "our very first" : "this month’s"
  } ${series.shortName} ${when.soon}!`;
  const change =
    "Change of plans? No worries. Open your pass and release your spot so someone else can come.";
  const { instagram } = series.contact;
  // `handle`: plain in the text email, a link in the HTML one.
  const ask = (handle: string) =>
    `Questions? Reply to this email${instagram ? ` or DM us on Instagram (${handle})` : ""} and we’ll get back to you!`;
  const seeYou = `We can’t wait to see you ${when.seeYou}!`;

  const html = page(`
      <p style="font-size:17px;line-height:1.5">Hi ${escapeHtml(name)}!</p>
      <p style="font-size:17px;line-height:1.5">${escapeHtml(opening)}</p>${noticeHtml(edition)}
      <p style="font-size:17px;line-height:1.8;margin:16px 0">📍 <strong>${escapeHtml(where)}</strong><br>🗓️ <strong>${escapeHtml(date)}</strong><br>⏰ <strong>${escapeHtml(time)}</strong></p>
      <p style="font-size:17px;line-height:1.5">Just bring yourself and your check-in code so we can get you in quickly :)</p>
      <p style="margin:0;font-family:monospace;font-size:28px;font-weight:700;letter-spacing:.15em;color:#2f5b3b">${registration.code}</p>
      ${passButton(passUrl)}
      <p style="font-size:15px;line-height:1.5">${change}</p>
      <p style="font-size:15px;line-height:1.5">${ask(
        `<a href="https://instagram.com/${escapeHtml(instagram)}" style="color:#2f5b3b">@${escapeHtml(instagram)}</a>`,
      )}</p>
      <p style="font-size:17px;line-height:1.5">${escapeHtml(seeYou)}</p>
      <p style="font-size:17px;line-height:1.5">Love,<br>Team Backyard</p>`);

  const text = [
    `Hi ${name}!`,
    opening,
    ...(edition.notice ? [`Heads up: ${edition.notice}`] : []),
    `📍 ${where}\n🗓️ ${date}\n⏰ ${time}`,
    `Just bring yourself and your check-in code, ${registration.code}, so we can get you in quickly :)`,
    `Your pass: ${passUrl}`,
    change,
    ask(`@${instagram}`),
    seeYou,
    "Love,\nTeam Backyard",
  ].join("\n\n");

  return { to: registration.email, subject: `BACKYARD: ${when.headline} 💚`, html, text };
}

/**
 * Reminds guests of their date, with their code and pass: one at a time over
 * one connection, to go easy on the provider. Resolves to how many the
 * provider took and the addresses it didn't.
 */
export async function sendReminderEmails(
  registrations: Registration[],
  edition: Edition,
  options: ReminderOptions,
): Promise<{ sent: number; failed: string[] }> {
  const mail = mailer("Reminder");
  if (!mail) return { sent: 0, failed: registrations.map((r) => r.email) };
  let sent = 0;
  const failed: string[] = [];
  try {
    for (const registration of registrations) {
      if (await mail.send(reminderEmail(registration, edition, options))) sent++;
      else failed.push(registration.email);
    }
  } finally {
    mail.close();
  }
  return { sent, failed };
}
