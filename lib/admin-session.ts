import { createHash, createHmac, timingSafeEqual } from "node:crypto";

// Signed, expiring admin cookie. No user accounts: one shared ADMIN_PASSWORD
// is enough for a small organising team. Imported by proxy.ts, so keep this
// file free of next/headers.

export const ADMIN_COOKIE = "backyard_admin";
export const SESSION_TTL_SECONDS = 60 * 60 * 12;

/**
 * Sessions are signed with SESSION_SECRET mixed with the current password, so
 * removing or changing ADMIN_PASSWORD signs everyone out. Outside production
 * the password stands in for a missing SESSION_SECRET.
 */
function secret(): string | null {
  if (adminConfigError()) return null;
  const password = process.env.ADMIN_PASSWORD as string;
  const base = process.env.SESSION_SECRET || password;
  return createHash("sha256").update(`${base}\0${password}`).digest("hex");
}

function sign(payload: string, key: string): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export const MIN_PASSWORD_LENGTH = 12;

/**
 * Why admin is switched off, or null if it's ready. In production the signing
 * key must not be derivable from the password alone, or a stolen cookie would
 * let someone test password guesses offline.
 */
export function adminConfigError(): string | null {
  if ((process.env.ADMIN_PASSWORD?.length ?? 0) < MIN_PASSWORD_LENGTH) {
    return `Set ADMIN_PASSWORD (at least ${MIN_PASSWORD_LENGTH} characters) to turn it on.`;
  }
  if (process.env.NODE_ENV === "production" && !process.env.SESSION_SECRET) {
    return "Set SESSION_SECRET (a long random value) to turn it on.";
  }
  return null;
}

export function isAdminConfigured(): boolean {
  return adminConfigError() === null;
}

export function checkPassword(attempt: string): boolean {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return false;
  // Compare digests so the check doesn't leak the password length.
  const digest = (s: string) => createHmac("sha256", "backyard").update(s).digest("hex");
  return safeEqual(digest(attempt), digest(password));
}

export function createSessionToken(nowMs: number): string {
  const key = secret();
  if (!key) throw new Error("Admin is not configured");
  const expires = Math.floor(nowMs / 1000) + SESSION_TTL_SECONDS;
  const payload = `admin.${expires}`;
  return `${payload}.${sign(payload, key)}`;
}

export function verifySessionToken(token: string | undefined, nowMs: number): boolean {
  const key = secret();
  if (!key || !token) return false;
  const lastDot = token.lastIndexOf(".");
  if (lastDot === -1) return false;
  const payload = token.slice(0, lastDot);
  const signature = token.slice(lastDot + 1);
  if (!safeEqual(signature, sign(payload, key))) return false;
  const expires = Number(payload.split(".")[1]);
  return Number.isFinite(expires) && expires * 1000 > nowMs;
}
