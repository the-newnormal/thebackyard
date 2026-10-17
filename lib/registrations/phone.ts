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

/** Normalised SG numbers are the 8 digits alone. */
export const isSingaporeNumber = (normalized: string) => /^\d{8}$/.test(normalized);

/** Joins a country code and the number as typed, e.g. "+60" + "012-345 6789". */
export function composePhone(dialCode: string, typed: string): string {
  const digits = typed.replace(/\D/g, "");
  // A whole international number typed or pasted in stands on its own.
  if (typed.trim().startsWith("+")) return `+${digits}`;
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  // SG's code typed again in front of the 8 digits, e.g. "65 9123 4567".
  if (dialCode === "+65" && /^65\d{8}$/.test(digits)) return `+${digits}`;
  // Drop the trunk 0 people dial at home; it isn't part of the international number.
  return `${dialCode}${digits.replace(/^0+/, "")}`;
}
