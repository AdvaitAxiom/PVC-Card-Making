"use client";

/**
 * Embeds the card fonts inside exported artwork.
 *
 * An SVG drawn through an <img> is its own little document, so the fonts the
 * page has loaded are not available to it. Without the font bytes travelling
 * with the SVG, an exported card silently falls back to a default face and
 * every weight collapses to regular or bold.
 */

const FONT_FILES: { family: string; url: string }[] = [
  { family: "Card Sans", url: "/fonts/inter-var.woff2" },
  { family: "Card Serif", url: "/fonts/source-serif-var.woff2" },
  { family: "Card Mono", url: "/fonts/roboto-mono-var.woff2" },
];

const cache = new Map<string, string>();

async function asDataUrl(url: string): Promise<string | null> {
  const hit = cache.get(url);
  if (hit) return hit;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    const dataUrl = `data:font/woff2;base64,${btoa(binary)}`;
    cache.set(url, dataUrl);
    return dataUrl;
  } catch {
    return null;
  }
}

/**
 * Builds a <style> block for whichever card fonts the markup actually uses,
 * so a card set in Arial does not carry font bytes it never needs.
 */
export async function buildFontStyle(markup: string): Promise<string> {
  const needed = FONT_FILES.filter((font) => markup.includes(font.family));
  if (needed.length === 0) return "";

  const faces = await Promise.all(
    needed.map(async (font) => {
      const dataUrl = await asDataUrl(font.url);
      if (!dataUrl) return "";
      return (
        `@font-face{font-family:'${font.family}';` +
        `src:url('${dataUrl}') format('woff2-variations');` +
        `font-weight:100 900;font-style:normal;}`
      );
    }),
  );

  const css = faces.filter(Boolean).join("");
  return css ? `<defs><style type="text/css">${css}</style></defs>` : "";
}

/** Waits for the page's own copies, so on-screen measuring is accurate too. */
export async function ensureFontsReady(): Promise<void> {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  try {
    // A font is only fetched once something draws with it, so ask explicitly.
    await Promise.all(
      FONT_FILES.flatMap((font) =>
        [300, 400, 500, 600, 700, 800, 900].map((weight) =>
          document.fonts.load(`${weight} 16px '${font.family}'`).catch(() => undefined),
        ),
      ),
    );
    await document.fonts.ready;
  } catch {
    // Nothing to do — fall back to whatever is already available.
  }
}
