import { cacheLife } from "next/cache";
import QRCode from "qrcode";
import { support } from "@/content/copy";
import { payNowPayload, type PayNowTarget } from "@/lib/paynow";

/** The QR as base64 PNG, made once per deploy: the number only changes with one. */
async function qrPng(target: PayNowTarget): Promise<string> {
  "use cache";
  cacheLife("max");
  const png = await QRCode.toBuffer(payNowPayload(target), {
    type: "png",
    // Medium error correction and a wide quiet zone scan well off a screen
    // or from a saved screenshot.
    errorCorrectionLevel: "M",
    margin: 4,
    width: 720,
  });
  return png.toString("base64");
}

/** `/paynow-qr.png`: the PayNow QR under the pass, from content/copy.ts. */
export async function GET() {
  const target = support.give.paynow;
  if (!target) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(await qrPng(target), "base64"), {
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=3600" },
  });
}
