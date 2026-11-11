// PayNow QR payloads (SGQR, built on the EMVCo merchant-presented QR spec).
// A static code for a mobile number or UEN; the payer types in the amount.

/** One EMVCo field: 2-digit id, 2-digit length, value. */
function field(id: string, value: string): string {
  if (value.length > 99) throw new Error(`PayNow field ${id} is too long`);
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

/** CRC-16/CCITT-FALSE (poly 0x1021, start 0xFFFF), as 4 upper-case hex digits. */
export function crc16(text: string): string {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(text)) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export type PayNowTarget =
  /** An 8-digit Singapore mobile number registered with PayNow. */
  | { mobile: string; reference?: string }
  /** A business's UEN registered with PayNow. */
  | { uen: string; reference?: string };

/** The text a PayNow QR code holds, with the amount left for the payer to fill in. */
export function payNowPayload(target: PayNowTarget): string {
  const proxy =
    "mobile" in target
      ? { type: "0", value: `+65${target.mobile.replace(/\D/g, "").replace(/^65(?=\d{8}$)/, "")}` }
      : { type: "2", value: target.uen.trim().toUpperCase() };
  const account =
    field("00", "SG.PAYNOW") +
    field("01", proxy.type) +
    field("02", proxy.value) +
    // 1: the payer can change the amount (there isn't one set).
    field("03", "1");
  const reference = target.reference?.trim();
  const body =
    field("00", "01") + // payload format
    field("01", "11") + // static: the same code every time
    field("26", account) +
    field("52", "0000") + // merchant category: not applicable
    field("53", "702") + // Singapore dollars
    field("58", "SG") +
    // Banking apps show the name PayNow has on record, not this.
    field("59", "NA") +
    field("60", "Singapore") +
    (reference ? field("62", field("01", reference)) : "") +
    "6304";
  return body + crc16(body);
}

/** Who to PayNow, as people type it into their banking app: "8690 9862", or the UEN. */
export function payNowRecipient(target: PayNowTarget): string {
  if ("uen" in target) return target.uen.trim().toUpperCase();
  const digits = target.mobile.replace(/\D/g, "").replace(/^65(?=\d{8}$)/, "");
  return `${digits.slice(0, 4)} ${digits.slice(4)}`;
}
