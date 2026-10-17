import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

// Optional: confirm mobile numbers with a texted code, through Twilio Verify
// (https://www.twilio.com/docs/verify). Set TWILIO_ACCOUNT_SID,
// TWILIO_AUTH_TOKEN and TWILIO_VERIFY_SERVICE_SID to switch it on. Without
// them, numbers are only checked for format. Twilio picks the code, texts it,
// expires it and limits retries; this file only relays and remembers the result.

const TOKEN_TTL_SECONDS = 2 * 60 * 60;

function account() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID?.trim();
  return accountSid && authToken && serviceSid ? { accountSid, authToken, serviceSid } : null;
}

export function isPhoneVerificationEnabled(): boolean {
  return account() !== null;
}

/** Stored SG numbers are 8 digits without +65; Twilio wants E.164. */
export const toE164 = (phone: string) => (/^\d{8}$/.test(phone) ? `+65${phone}` : phone);

async function verify(
  path: "Verifications" | "VerificationCheck",
  params: Record<string, string>,
): Promise<{ status: number; body: { status?: string; code?: number; message?: string } }> {
  const twilio = account();
  if (!twilio) throw new Error("Phone verification is not configured");
  const response = await fetch(
    `https://verify.twilio.com/v2/Services/${twilio.serviceSid}/${path}`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${twilio.accountSid}:${twilio.authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(params),
      signal: AbortSignal.timeout(10_000),
    },
  );
  return { status: response.status, body: await response.json().catch(() => ({})) };
}

export type SendResult = "sent" | "invalid" | "too-many" | "failed";

export async function sendVerificationCode(phone: string): Promise<SendResult> {
  try {
    const { status, body } = await verify("Verifications", { To: toE164(phone), Channel: "sms" });
    if (status === 200 || status === 201) return "sent";
    // Twilio error codes; the number itself stays out of the logs.
    console.error("Twilio Verify send failed", status, body.code, body.message);
    if (body.code === 60200 || body.code === 60205 || body.code === 60410) return "invalid";
    if (status === 429 || body.code === 60203 || body.code === 60212) return "too-many";
    return "failed";
  } catch (error) {
    console.error("Twilio Verify send failed", error);
    return "failed";
  }
}

export type CheckResult = "approved" | "wrong" | "expired" | "too-many" | "failed";

export async function checkVerificationCode(phone: string, code: string): Promise<CheckResult> {
  try {
    const { status, body } = await verify("VerificationCheck", { To: toE164(phone), Code: code });
    if (status === 200) return body.status === "approved" ? "approved" : "wrong";
    // 404: no code waiting, because it expired, was used or had too many tries.
    if (status === 404) return "expired";
    console.error("Twilio Verify check failed", status, body.code, body.message);
    if (status === 429 || body.code === 60202) return "too-many";
    return "failed";
  } catch (error) {
    console.error("Twilio Verify check failed", error);
    return "failed";
  }
}

// After a correct code, the browser holds a short-lived signed token for that
// number and sends it with the registration, so the sign-up can't claim a
// number nobody confirmed.

function tokenKey(): string {
  const base = `${process.env.SESSION_SECRET ?? ""}\0${account()?.authToken ?? ""}`;
  return createHash("sha256").update(`backyard:phone\0${base}`).digest("hex");
}

const sign = (phone: string, expires: number) =>
  createHmac("sha256", tokenKey()).update(`${phone}.${expires}`).digest("base64url");

export function createPhoneToken(phone: string, nowMs: number): string {
  const expires = Math.floor(nowMs / 1000) + TOKEN_TTL_SECONDS;
  return `${expires}.${sign(phone, expires)}`;
}

export function verifyPhoneToken(token: string, phone: string, nowMs: number): boolean {
  const [expiresText, signature = ""] = token.split(".");
  const expires = Number(expiresText);
  if (!Number.isInteger(expires) || expires * 1000 <= nowMs) return false;
  const expected = Buffer.from(sign(phone, expires));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
