import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

// Optional: confirm Singapore mobile numbers with a texted code, through
// Twilio Verify (https://www.twilio.com/docs/verify). Set TWILIO_ACCOUNT_SID,
// TWILIO_AUTH_TOKEN and TWILIO_VERIFY_SERVICE_SID to switch it on. Without
// them, numbers are only checked for format. Twilio picks the code, texts it,
// expires it and limits retries; this file relays and remembers the result.
// Codes only go to Singapore numbers, which keeps the bill safe from people
// scripting texts to premium-rate numbers abroad.

const TOKEN_TTL_SECONDS = 2 * 60 * 60;
const TWILIO_VARS = ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_VERIFY_SERVICE_SID"];

let warnedPartial = false;

function account() {
  const [accountSid, authToken, serviceSid] = TWILIO_VARS.map((name) => process.env[name]?.trim());
  if (accountSid && authToken && serviceSid) return { accountSid, authToken, serviceSid };
  if (!warnedPartial && (accountSid || authToken || serviceSid)) {
    warnedPartial = true;
    console.warn(`Phone verification is off: set all of ${TWILIO_VARS.join(", ")}.`);
  }
  return null;
}

export function isPhoneVerificationEnabled(): boolean {
  return account() !== null;
}

/** Stored SG numbers are 8 digits without +65; Twilio wants E.164. */
const toE164 = (phone: string) => (/^\d{8}$/.test(phone) ? `+65${phone}` : phone);

async function verify(
  path: "Verifications" | "VerificationCheck",
  params: Record<string, string>,
): Promise<{ status: number; body: { status?: string; code?: number } }> {
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

// A speed bump against scripted sends from one place. Per server instance,
// so it isn't a hard limit, but Twilio caps each number on top of it.
const WINDOW_MS = 10 * 60 * 1000;
const PER_IP = 5;
const PER_INSTANCE = 100;
const sends = new Map<string, number[]>();

/** "visitor" when this IP has had its share; "busy" when this instance has. */
export function allowSend(ip: string, nowMs: number): "ok" | "visitor" | "busy" {
  // Forget visitors whose sends have all expired.
  for (const [key, times] of sends) {
    if (times.every((t) => nowMs - t >= WINDOW_MS)) sends.delete(key);
  }
  const recent = (key: string) => (sends.get(key) ?? []).filter((t) => nowMs - t < WINDOW_MS);
  const mine = recent(ip);
  const everyone = recent("*");
  if (mine.length >= PER_IP) return "visitor";
  if (everyone.length >= PER_INSTANCE) return "busy";
  sends.set(ip, [...mine, nowMs]);
  sends.set("*", [...everyone, nowMs]);
  return "ok";
}

/** "blocked" covers Twilio refusing the destination (Fraud Guard, geo permissions). */
export type SendResult = "sent" | "invalid" | "too-many" | "blocked" | "failed";

export async function sendVerificationCode(phone: string): Promise<SendResult> {
  try {
    const { status, body } = await verify("Verifications", { To: toE164(phone), Channel: "sms" });
    if (status === 200 || status === 201) return "sent";
    // Only Twilio's status and error code: its messages can quote the number.
    console.error("Twilio Verify send failed", status, body.code);
    if (body.code === 60200 || body.code === 60205) return "invalid";
    if (status === 429 || body.code === 60203 || body.code === 60212) return "too-many";
    if (body.code === 60410 || body.code === 60605) return "blocked";
    return "failed";
  } catch (error) {
    console.error("Twilio Verify send failed", error instanceof Error ? error.name : error);
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
    console.error("Twilio Verify check failed", status, body.code);
    if (status === 429 || body.code === 60202) return "too-many";
    return "failed";
  } catch (error) {
    console.error("Twilio Verify check failed", error instanceof Error ? error.name : error);
    return "failed";
  }
}

// After the check, the browser holds a short-lived signed token for that
// number and email, and sends it with the registration. It says whether the
// number was confirmed, or whether Twilio couldn't be reached and the check
// was skipped, so a Twilio outage doesn't stop sign-ups.

function tokenKey(): string {
  const base = `${process.env.SESSION_SECRET ?? ""}\0${account()?.authToken ?? ""}`;
  return createHash("sha256").update(`backyard:phone\0${base}`).digest("hex");
}

const sign = (phone: string, email: string, expires: number, verified: boolean) =>
  createHmac("sha256", tokenKey())
    .update([phone, email.trim().toLowerCase(), expires, verified ? 1 : 0].join("\n"))
    .digest("base64url");

export function createPhoneToken(
  phone: string,
  email: string,
  verified: boolean,
  nowMs: number,
): string {
  const expires = Math.floor(nowMs / 1000) + TOKEN_TTL_SECONDS;
  return `${expires}.${verified ? 1 : 0}.${sign(phone, email, expires, verified)}`;
}

/** The token's verdict for this number and email, or null if it doesn't hold. */
export function readPhoneToken(
  token: string,
  phone: string,
  email: string,
  nowMs: number,
): { verified: boolean } | null {
  const [expiresText, flag, signature = ""] = token.split(".");
  const expires = Number(expiresText);
  if (!Number.isInteger(expires) || expires * 1000 <= nowMs) return null;
  if (flag !== "0" && flag !== "1") return null;
  const verified = flag === "1";
  const expected = Buffer.from(sign(phone, email, expires, verified));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given)
    ? { verified }
    : null;
}
