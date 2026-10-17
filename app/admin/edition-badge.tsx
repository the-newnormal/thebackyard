import { editionState } from "@/lib/editions/select";
import type { Edition, EditionStats } from "@/lib/editions/types";
import { formatMoment } from "@/lib/format";

/** Where an edition is in its life, for organisers. */
export function EditionBadge({
  edition,
  now,
  stats,
}: {
  edition: Edition;
  now: Date;
  stats?: EditionStats;
}) {
  const state = editionState(edition, now);
  const full =
    edition.capacity !== null && stats !== undefined && (stats.waitlist > 0 || stats.confirmed >= edition.capacity);
  const [label, tone] = {
    draft: ["Draft · not public", "bg-forest/10 text-muted"],
    cancelled: ["Called off", "bg-red text-card"],
    upcoming: [`Opens ${formatMoment(edition.registrationOpensAt ?? edition.startsAt)}`, "bg-cream text-forest"],
    open: [full ? "Full · waitlist open" : "Registration open", full ? "bg-mustard text-forest-deep" : "bg-lime text-forest-deep"],
    closed: ["Registration closed", "bg-forest/10 text-forest"],
    live: ["Happening now", "bg-orange text-forest-deep"],
    past: ["Past", "bg-forest/10 text-muted"],
  }[state];
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${tone}`}>{label}</span>;
}
