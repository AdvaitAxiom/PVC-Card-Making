"use client";

import { CardTemplate } from "./types";

/**
 * The app's built-in templates.
 *
 * These are built from the `card-templates/` folder into
 * `public/builtin-templates.json`, then fetched at runtime rather than bundled,
 * because card artwork can easily run to several megabytes.
 */

let cache: CardTemplate[] | null = null;
let inFlight: Promise<CardTemplate[]> | null = null;

export async function loadSeedTemplates(): Promise<CardTemplate[]> {
  if (cache) return cache;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const response = await fetch("/builtin-templates.json", { cache: "no-store" });
      if (!response.ok) throw new Error(String(response.status));
      const data = (await response.json()) as CardTemplate[];
      cache = Array.isArray(data) ? data.map((t) => ({ ...t, builtIn: true })) : [];
    } catch {
      // A missing or broken file must not stop the app from opening.
      cache = [];
    } finally {
      inFlight = null;
    }
    return cache ?? [];
  })();

  return inFlight;
}

export const BLANK_FRONT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 856 540" width="856" height="540">
  <rect width="856" height="540" rx="32" fill="#ffffff"/>
  <rect x="2" y="2" width="852" height="536" rx="30" fill="none" stroke="#cbd5e1" stroke-width="3" stroke-dasharray="10 8"/>
  <text x="428" y="286" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="28" fill="#94a3b8">FRONT — upload your SVG</text>
</svg>`;

export const BLANK_BACK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 856 540" width="856" height="540">
  <rect width="856" height="540" rx="32" fill="#ffffff"/>
  <rect x="2" y="2" width="852" height="536" rx="30" fill="none" stroke="#cbd5e1" stroke-width="3" stroke-dasharray="10 8"/>
  <text x="428" y="286" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="28" fill="#94a3b8">BACK — upload your SVG</text>
</svg>`;
