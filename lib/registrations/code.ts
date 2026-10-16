import { randomBytes, randomInt } from "node:crypto";

// No 0/O, 1/I/L — easy to read out loud at the check-in table.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const LENGTH = 6;

export function generateCode(): string {
  let code = "";
  for (let i = 0; i < LENGTH; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return code;
}

export function normalizeCode(input: string): string {
  return input.trim().toUpperCase();
}

export function isValidCode(input: string): boolean {
  return new RegExp(`^[${ALPHABET}]{${LENGTH}}$`).test(input);
}

/** 256-bit random token for pass URLs. */
export function generatePassToken(): string {
  return randomBytes(32).toString("base64url");
}

export function isValidPassToken(input: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(input);
}
