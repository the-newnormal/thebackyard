import "server-only";
import { event } from "@/content/event";
import { eventDateLong, eventTimeRange, firstName } from "./format";
import { partySize, type Registration } from "./registrations/types";
import { siteUrl } from "./site";

// Optional confirmation emails via Resend (https://resend.com).
// Set RESEND_API_KEY and EMAIL_FROM to turn them on; otherwise this is a no-op.

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export async function sendConfirmationEmail(registration: Registration): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return;

  const passUrl = `${siteUrl()}/pass/${registration.passToken}`;
  const waitlisted = registration.status === "waitlist";
  const name = escapeHtml(firstName(registration.name));
  const party = partySize(registration);
  const where = `${event.venue.name} (${event.venue.level}), ${event.venue.address}`;

  const subject = waitlisted
    ? `You’re on the Backyard waitlist (${registration.code})`
    : `You’re in — see you at Backyard (${registration.code})`;

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#f4f1ea;padding:32px 16px;color:#1d2a20">
    <div style="max-width:520px;margin:0 auto;background:#fffdf7;border-radius:16px;padding:32px;border:2px solid #2f5b3b">
      <p style="margin:0 0 4px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#e88732;font-weight:700">${escapeHtml(event.tagline.join(" | "))}</p>
      <h1 style="margin:0 0 16px;font-size:30px;font-style:italic;font-weight:900;color:#2f5b3b">BACKYARD</h1>
      <p style="font-size:17px;line-height:1.5">Hey ${name},</p>
      <p style="font-size:17px;line-height:1.5">${
        waitlisted
          ? "We’re at capacity right now, so you’re on the waitlist. If a spot opens up we’ll let you know."
          : `You’re in! We’ve saved ${party === 1 ? "a spot" : `${party} spots`} for you at the ${escapeHtml(event.shortName.toLowerCase())}.`
      }</p>
      <table style="width:100%;font-size:15px;line-height:1.5;margin:16px 0;border-collapse:collapse">
        <tr><td style="padding:6px 0;color:#6b6b5e;width:90px">When</td><td style="padding:6px 0"><strong>${escapeHtml(eventDateLong())}, ${escapeHtml(eventTimeRange())}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#6b6b5e">Where</td><td style="padding:6px 0"><strong>${escapeHtml(where)}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#6b6b5e">Code</td><td style="padding:6px 0"><strong style="font-family:monospace;font-size:18px;letter-spacing:.15em">${registration.code}</strong></td></tr>
      </table>
      <p style="margin:24px 0"><a href="${passUrl}" style="background:#2f5b3b;color:#f9ecd0;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:700">View your pass</a></p>
      <p style="font-size:14px;line-height:1.5;color:#6b6b5e">Plans changed? Open your pass and release your spot so someone else can come.</p>
    </div>
  </div>`;

  const text = [
    `Hey ${firstName(registration.name)},`,
    waitlisted
      ? "We’re at capacity right now, so you’re on the waitlist. If a spot opens up we’ll let you know."
      : `You’re in! Party of ${party}.`,
    `When: ${eventDateLong()}, ${eventTimeRange()}`,
    `Where: ${where}`,
    `Code: ${registration.code}`,
    `Your pass: ${passUrl}`,
  ].join("\n\n");

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: registration.email, subject, html, text }),
    });
    if (!response.ok) {
      console.error("Confirmation email failed", response.status, await response.text());
    }
  } catch (error) {
    console.error("Confirmation email failed", error);
  }
}
