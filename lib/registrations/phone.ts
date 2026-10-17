/** Strips spaces/dashes and a leading +65 so SG numbers compare equal. */
export function normalizePhone(input: string): string {
  const digits = input.replace(/[^\d+]/g, "");
  return digits.replace(/^\+?65(?=\d{8}$)/, "");
}

/**
 * A normalised number: 8 SG digits starting 3, 6, 8 or 9, or another
 * country's number with its code. +65 numbers are normalised to 8 digits
 * first, so any left over are malformed.
 */
export const PHONE_PATTERN = /^(\+(?!65)\d{8,15}|[3689]\d{7})$/;

/** Joins a country code and a number typed the local way, e.g. "+60" + "012-345 6789". */
export function composePhone(dialCode: string, local: string): string {
  const digits = local.replace(/\D/g, "");
  // Pasted or autofilled with its own country code ("+60 12…", "0060 12…").
  if (/^\s*(\+|00)/.test(local)) return `+${digits.replace(/^00/, "")}`;
  // Drop the trunk 0 people dial at home; it isn't part of the international number.
  const national = digits.replace(/^0+/, "");
  // An SG number with 65 in front but no +.
  if (dialCode === "+65" && /^65\d{8}$/.test(national)) return `+${national}`;
  return `${dialCode}${national}`;
}
