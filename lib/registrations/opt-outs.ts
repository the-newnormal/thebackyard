import { EMAIL_PATTERN } from "./email";
import { normalizePhone, PHONE_PATTERN } from "./phone";
import type { OptOut, Registration } from "./types";

// People opt out of updates by emailing the DPO (Terms, Part B clause 7). An
// organiser records it by email address or number, and it covers every
// registration with either, on every date, including later sign-ups, until
// they ask in writing to hear from us again.

/** An email address (lowercased) or a normalised number; null if it's neither. */
export function contactKey(input: string): string | null {
  const value = input.trim();
  if (value.includes("@")) {
    const email = value.toLowerCase();
    return EMAIL_PATTERN.test(email) && email.length <= 200 ? email : null;
  }
  const phone = normalizePhone(value);
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
    !optedOut.has(normalizePhone(r.phone))
  );
}
