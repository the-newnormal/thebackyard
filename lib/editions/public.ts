import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { getStore, isStoreConfigured } from "../registrations";
import {
  calledOff,
  editionState,
  featured,
  nextBoundarySeconds,
  nextOpening,
  registrable,
  type EditionState,
} from "./select";
import type { Edition } from "./types";

export interface PublicSchedule {
  /** The edition the homepage is about (tonight's, or the next one). */
  featured: Edition | null;
  featuredState: EditionState | null;
  /** The edition /register signs people up for right now, if any. */
  openFor: Edition | null;
  /** The next edition whose registration opens later. */
  nextOpening: Edition | null;
  /** A called-off edition that would otherwise be next. */
  calledOff: Edition | null;
}

const EMPTY: PublicSchedule = {
  featured: null,
  featuredState: null,
  openFor: null,
  nextOpening: null,
  calledOff: null,
};

const MIN_LIFETIME = 300; // Shorter-lived entries are left out of the prerendered page.
const MAX_LIFETIME = 86_400;

/**
 * The homepage's view of the schedule, prerendered and cached until the next
 * time any edition opens, closes, starts or ends (at least five minutes, so
 * the switch can show up to five minutes late; /register and the sign-up
 * action always check the live data). Saving an edition in /admin refreshes
 * it straight away through the "editions" tag. Drafts are never included.
 */
export async function getPublicSchedule(): Promise<PublicSchedule> {
  "use cache";
  cacheTag("editions");

  // Preview deployments without a database show the "next date soon" state.
  if (!isStoreConfigured()) {
    cacheLife({ stale: MIN_LIFETIME, revalidate: MAX_LIFETIME, expire: MAX_LIFETIME });
    return EMPTY;
  }

  const now = new Date();
  const editions = (await getStore().listEditions()).filter((e) => e.status !== "draft");

  const lifetime = Math.min(
    MAX_LIFETIME,
    Math.max(MIN_LIFETIME, nextBoundarySeconds(editions, now) ?? MAX_LIFETIME),
  );
  cacheLife({ stale: MIN_LIFETIME, revalidate: lifetime, expire: lifetime });

  const next = featured(editions, now);
  return {
    featured: next,
    featuredState: next && editionState(next, now),
    openFor: registrable(editions, now)[0] ?? null,
    nextOpening: nextOpening(editions, now),
    calledOff: calledOff(editions, now),
  };
}
