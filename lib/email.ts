import "server-only";
import { createTransport } from "nodemailer";
import { series } from "@/content/series";
import type { Edition } from "./editions/types";
import { eventDateLong, eventDateShort, eventTimeRange, firstName } from "./format";
import { partySize, type Registration } from "./registrations/types";
import { siteUrl } from "./site";

// Optional confirmation emails, sent through either:
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

/** Confirms a sign-up (or a spot given from the waitlist) for its own edition. */
export async function sendConfirmationEmail(
  registration: Registration,
  edition: Edition,
): Promise<void> {
  const gmail = gmailAccount();
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM?.trim() || gmail?.user;
  if (!gmail && !(apiKey && from)) return;

  const passUrl = `${siteUrl()}/pass/${registration.passToken}`;
  const waitlisted = registration.status === "waitlist";
  const name = escapeHtml(greetingName(registration.name));
  const party = partySize(registration);
  const { venue } = edition;
  const where = `${venue.name}${venue.level ? ` (${venue.level})` : ""}, ${venue.address}`;
  const when = `${eventDateLong(edition)}, ${eventTimeRange(edition)}`;
  // The date keeps one month's email apart from the next in a busy inbox.
  const subject = `${waitlisted ? "You’re on the waitlist" : "You’re in"} — Backyard, ${eventDateShort(edition)} (${registration.code})`;

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#f4f1ea;padding:32px 16px;color:#1d2a20">
    <div style="max-width:520px;margin:0 auto;background:#fffdf7;border-radius:16px;padding:32px;border:2px solid #2f5b3b">
      <p style="margin:0 0 4px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#e88732;font-weight:700">${escapeHtml(series.tagline.join(" | "))}</p>
      <h1 style="margin:0 0 16px;font-size:30px;font-style:italic;font-weight:900;color:#2f5b3b">BACKYARD</h1>
      <p style="font-size:17px;line-height:1.5">Hey ${name},</p>
      <p style="font-size:17px;line-height:1.5">${
        waitlisted
          ? "We’re at capacity right now, so you’re on the waitlist. If a spot opens up we’ll let you know."
          : `You’re in! We’ve saved ${party === 1 ? "a spot" : `${party} spots`} for you at the ${escapeHtml(series.shortName.toLowerCase())}.`
      }</p>${
        edition.notice
          ? `
      <p style="font-size:15px;line-height:1.5;background:#f3e2a9;border-radius:10px;padding:12px 14px"><strong>Heads up:</strong> ${escapeHtml(edition.notice)}</p>`
          : ""
      }
      <table style="width:100%;font-size:15px;line-height:1.5;margin:16px 0;border-collapse:collapse">
        <tr><td style="padding:6px 0;color:#6b6b5e;width:90px">When</td><td style="padding:6px 0"><strong>${escapeHtml(when)}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#6b6b5e">Where</td><td style="padding:6px 0"><strong>${escapeHtml(where)}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#6b6b5e">Code</td><td style="padding:6px 0"><strong style="font-family:monospace;font-size:18px;letter-spacing:.15em">${registration.code}</strong></td></tr>
      </table>
      <p style="margin:24px 0"><a href="${passUrl}" style="background:#2f5b3b;color:#f9ecd0;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:700">View your pass</a></p>
      <p style="font-size:14px;line-height:1.5;color:#6b6b5e">Plans changed? Open your pass and release your spot so someone else can come.</p>
    </div>
  </div>`;

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

  const message = { from, to: registration.email, subject, html, text };

  if (gmail) {
    try {
      const transport = createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: gmail,
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
      });
      await transport.sendMail(message);
      console.info("Confirmation email sent via Gmail");
    } catch (error) {
      console.error("Confirmation email failed (Gmail)", error);
    }
    return;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });
    if (!response.ok) {
      console.error("Confirmation email failed", response.status, await response.text());
    }
  } catch (error) {
    console.error("Confirmation email failed", error);
  }
}
