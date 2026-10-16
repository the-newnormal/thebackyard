/** Strips spaces/dashes and a leading +65 so SG numbers compare equal. */
export function normalizePhone(input: string): string {
  const digits = input.replace(/[^\d+]/g, "");
  return digits.replace(/^\+?65(?=\d{8}$)/, "");
}
