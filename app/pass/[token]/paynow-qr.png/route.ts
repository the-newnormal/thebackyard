import { cacheLife } from "next/cache";
import QRCode from "qrcode";
import { payNow } from "@/content/paynow";
import { getStore } from "@/lib/registrations";
import { isValidPassToken } from "@/lib/registrations/code";
import { payNowPayload, type PayNowTarget } from "@/lib/paynow";

/** The QR as base64 PNG, made once per number. */
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

/**
 * `/pass/<token>/paynow-qr.png`: the PayNow QR under a pass, for that pass's
 * holder only, as the number in it is a person's.
 */
export async function GET(_request: Request, { params }: RouteContext<"/pass/[token]/paynow-qr.png">) {
  const { token } = await params;
  const notFound = () => new Response("Not found", { status: 404 });
  if (!payNow || !isValidPassToken(token)) return notFound();
  if (!(await getStore().getByPassToken(token))) return notFound();
  return new Response(Buffer.from(await qrPng(payNow), "base64"), {
    headers: {
      "Content-Type": "image/png",
      // Checked again on every view, so a changed number never shows an old QR.
      "Cache-Control": "private, no-cache",
    },
  });
}
