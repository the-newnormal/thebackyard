import "server-only";
import type { PayNowTarget } from "@/lib/paynow";

// Who "Chip in" under each pass asks people to PayNow: a `mobile` number, or a
// `uen` for a business. The reference is filled in when someone scans. Set it
// to null to hide the financial part. Kept out of content/copy.ts so the
// number only reaches pass holders, never a public page's code.
//
// After changing it, scan the new QR with a banking app before deploying and
// check the name it shows.
export const payNow: PayNowTarget | null = { mobile: "86909862", reference: "BACKYARD" };
