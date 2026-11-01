import { series } from "@/content/series";
import { ageOn, dateIn } from "./birthdate";
import type { Registration } from "./types";

/** The day an edition happens in Singapore, as YYYY-MM-DD. */
export const editionDay = (edition: { startsAt: string }) =>
  dateIn(series.timeZone, new Date(edition.startsAt));

/**
 * How old they'll be on `day` (their edition's day): from their birthdate, or
 * the age a walk-in gave. Null if we didn't ask.
 */
export function ageOnDay(r: Pick<Registration, "birthdate" | "age">, day: string): number | null {
  return r.birthdate ? ageOn(r.birthdate, day) : r.age;
}

export const AGE_GROUPS = [
  { label: "Under 15", max: 14 },
  { label: "15–17", max: 17 },
  { label: "18–25", max: 25 },
  { label: "26–35", max: 35 },
  { label: "36 and above", max: Infinity },
] as const;

export function ageGroup(age: number): string {
  return (AGE_GROUPS.find((g) => age <= g.max) ?? AGE_GROUPS[AGE_GROUPS.length - 1]).label;
}
