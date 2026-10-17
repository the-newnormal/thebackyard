// Birthdates are typed as DD/MM/YYYY and stored as YYYY-MM-DD. Shared by the
// form and the server, so neither needs a date library.

const EARLIEST_YEAR = 1920;

/** Groups typed digits as DD/MM/YYYY, e.g. "0105" → "01/05". */
export function formatBirthdateInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join("/");
}

/** "01/05/2007" → "2007-05-01", or null unless it's a real calendar date. */
export function parseBirthdate(input: string): string | null {
  const match = /^(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{4})$/.exec(input.trim());
  if (!match) return null;
  const [day, month, year] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return isRealDate(iso) ? iso : null;
}

/** "2007-05-01" → "01/05/2007" */
export function birthdateForInput(iso: string): string {
  const [year, month, day] = iso.split("-");
  return year && month && day ? `${day}/${month}/${year}` : "";
}

function isRealDate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const date = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(iso);
}

/** Today's date in `timeZone`, as YYYY-MM-DD. */
export function dateIn(timeZone: string, at: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(at);
}

/** Why a stored birthdate isn't acceptable, or null if it is. */
export function birthdateProblem(iso: string, today: string): string | null {
  if (!isRealDate(iso) || Number(iso.slice(0, 4)) < EARLIEST_YEAR) {
    return "That date doesn’t look right. Use DD/MM/YYYY";
  }
  if (iso > today) return "That date hasn’t happened yet";
  return null;
}

/** Whole years old on `on` (both YYYY-MM-DD). */
export function ageOn(birthdate: string, on: string): number {
  const years = Number(on.slice(0, 4)) - Number(birthdate.slice(0, 4));
  return on.slice(5) < birthdate.slice(5) ? years - 1 : years;
}
