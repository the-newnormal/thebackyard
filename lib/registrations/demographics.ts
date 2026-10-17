import { event } from "@/content/event";
import { ageOn, dateIn } from "./birthdate";
import type { Registration } from "./types";

const eventDay = dateIn(event.timeZone, new Date(event.startsAt));

/** How old they'll be at the event, or null if we didn't ask. */
export function ageOnEventDay(r: Pick<Registration, "birthdate">): number | null {
  return r.birthdate ? ageOn(r.birthdate, eventDay) : null;
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
