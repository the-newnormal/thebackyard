"use client";

import { useEffect } from "react";
import { event } from "@/content/event";

/** Unfinished answers are kept in this browser so people can pick up where they left off. */
export const PROGRESS_KEY = `backyard:registration:${event.slug}`;

/** Forgets the unfinished answers once the registration has gone through. */
export function ClearRegistrationProgress() {
  useEffect(() => {
    try {
      localStorage.removeItem(PROGRESS_KEY);
    } catch {
      // Storage blocked: nothing was saved either.
    }
  }, []);
  return null;
}
