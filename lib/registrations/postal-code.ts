/**
 * Singapore postal codes: six digits, the first two the postal sector (01 to
 * 82; 74 isn't used). Spaces are dropped, so "238 801" counts.
 */
export const normalizePostalCode = (input: string) => input.replace(/\s/g, "");

export function isPostalCode(normalized: string): boolean {
  if (!/^\d{6}$/.test(normalized)) return false;
  const sector = Number(normalized.slice(0, 2));
  return sector >= 1 && sector <= 82 && sector !== 74;
}

export const POSTAL_CODE_ERROR = "Use a 6-digit Singapore postal code";
