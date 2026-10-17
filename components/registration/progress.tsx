"use client";

import { useEffect } from "react";

/**
 * Unfinished answers are kept in this browser, per date, so people can pick
 * up where they left off.
 */
export const progressKey = (edition: string) => `backyard:registration:${edition}`;

/** Forgets the unfinished answers once the registration has gone through. */
export function ClearRegistrationProgress({ edition }: { edition: string }) {
  useEffect(() => {
    try {
      localStorage.removeItem(progressKey(edition));
    } catch {
      // Storage blocked: nothing was saved either.
    }
  }, [edition]);
  return null;
}
