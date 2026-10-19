import { COUNTRIES } from "@/components/registration/countries";
import { EMAIL_PATTERN } from "./email";
import { normalizePhone, PHONE_PATTERN } from "./phone";
import type { OptOut, Registration } from "./types";

// People opt out of updates by emailing the DPO (Terms, Part B clause 7). An
// organiser records it by email address or number, and it covers every
// registration with either, on every date, including later sign-ups, until
// they ask in writing to hear from us again.

// Longest first, so no code is taken for the start of a longer one.
const DIAL_CODES = [...new Set(COUNTRIES.map((c) => c.code))].sort(
  (a, b) => b.length - a.length,
);

/**
 * A number the way the sign-up stores it when its country is picked from the
 * list: without "(0)" or the trunk 0 people type after the code ("+60 012…").
 */
function canonicalPhone(input: string): string {
  const phone = normalizePhone(input.replace(/\(\s*0\s*\)/g, "").replace(/^\s*00/, "+"));
  const code = DIAL_CODES.find((c) => phone.startsWith(c));
  return code ? normalizePhone(code + phone.slice(code.length).replace(/^0+/, "")) : phone;
}

/** An email address (lowercased) or a number; null if it's neither. */
export function contactKey(input: string): string | null {
  const value = input.trim();
  if (value.includes("@")) {
    const email = value.toLowerCase();
    return EMAIL_PATTERN.test(email) && email.length <= 200 ? email : null;
  }
  // A stray letter is a typo, not something to drop: "9123a4567" isn't 91234567.
  if (!/^[\d\s()+.-]+$/.test(value)) return null;
  const phone = canonicalPhone(value);
  return PHONE_PATTERN.test(phone) ? phone : null;
}

export const optOutSet = (optOuts: OptOut[]) => new Set(optOuts.map((o) => o.contact));

/** They agreed to updates when they signed up, and haven't opted out since. */
export function wantsUpdates(
  r: Pick<Registration, "marketingOptIn" | "email" | "phone">,
  optedOut: ReadonlySet<string>,
): boolean {
  return (
    r.marketingOptIn &&
    !optedOut.has(r.email.toLowerCase()) &&
    !optedOut.has(canonicalPhone(r.phone))
  );
}
