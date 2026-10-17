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

/**
 * Joins a country code and a number typed the local way, e.g. "+60" +
 * "012-345 6789". `maxDigits` is the longest number in that country without
 * its code, to spot the code typed again without a +.
 */
export function composePhone(dialCode: string, local: string, maxDigits = 15): string {
  // Keeps only digits and +, which also drops the invisible marks around
  // numbers copied on iPhones. "(0)" is a trunk 0: "+44 (0)7911 123456".
  const compact = local.replace(/\(\s*0\s*\)/g, "").replace(/[^\d+]/g, "");
  // Pasted or autofilled with its own country code ("+60 12…", "0060 12…").
  if (/^(\+|00)/.test(compact)) return `+${compact.replace(/^(\+|00)/, "").replace(/\D/g, "")}`;
  // Drop the trunk 0 people dial at home; it isn't part of the international number.
  let national = compact.replace(/\D/g, "").replace(/^0+/, "");
  // Too long to be a number there, so it starts with the code: "65 9123 4567".
  const code = dialCode.slice(1);
  if (national.length > maxDigits && national.startsWith(code)) {
    national = national.slice(code.length).replace(/^0+/, "");
  }
  return `${dialCode}${national}`;
}
