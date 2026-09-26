"use client";

import QRCode from "qrcode";

/** Turns any text or link into a QR code picture the card can show. */
export async function makeQrDataUrl(
  text: string,
  options: { dark?: string; light?: string } = {},
): Promise<string> {
  if (!text.trim()) return "";
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 600,
    color: {
      dark: options.dark ?? "#000000",
      light: options.light ?? "#ffffff",
    },
  });
}
