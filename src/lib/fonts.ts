"use client";

/**
 * Works out which weights a font can really draw.
 *
 * Most fonts installed on a computer only carry regular and bold. Asking for
 * "Semi Bold" then quietly gives you bold, which looks like the control is
 * broken. Measuring the text lets the UI say so instead.
 */

const PROBE = "Hamburgefonstiv 0123456789";
const cache = new Map<string, number[]>();

/** Families the app ships itself, which must be fetched before measuring. */
const OWN_FAMILIES = ["Card Sans", "Card Serif", "Card Mono"];

let ctx: CanvasRenderingContext2D | null = null;
function context(): CanvasRenderingContext2D | null {
  if (!ctx && typeof document !== "undefined") {
    ctx = document.createElement("canvas").getContext("2d");
  }
  return ctx;
}

/**
 * Pulls the app's own fonts down.
 *
 * A browser only fetches a font when something actually draws with it, and
 * measuring on a canvas does not count. Without this, every measurement would
 * describe the fallback face rather than the real one.
 */
export async function loadOwnFonts(weights: number[]): Promise<void> {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  const jobs: Promise<unknown>[] = [];
  for (const family of OWN_FAMILIES) {
    for (const weight of weights) {
      jobs.push(document.fonts.load(`${weight} 16px '${family}'`).catch(() => undefined));
    }
  }
  await Promise.all(jobs);
  cache.clear();
}

/**
 * Returns the weights that really draw differently from one another.
 *
 * Ink is counted rather than width, because a monospaced font keeps the same
 * advance for every weight while the strokes still get heavier.
 */
export function supportedWeights(fontFamily: string, weights: number[]): number[] {
  const key = `${fontFamily}|${weights.join(",")}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const c = context();
  if (!c) return weights;

  const W = 420;
  const H = 60;
  c.canvas.width = W;
  c.canvas.height = H;

  const inkFor = (weight: number) => {
    c.clearRect(0, 0, W, H);
    c.fillStyle = "#ffffff";
    c.fillRect(0, 0, W, H);
    c.fillStyle = "#000000";
    c.font = `${weight} 34px ${fontFamily}`;
    c.textBaseline = "middle";
    c.fillText(PROBE, 4, H / 2);
    const data = c.getImageData(0, 0, W, H).data;
    let ink = 0;
    for (let i = 0; i < data.length; i += 4) {
      // Weight shows up as coverage, so sum darkness rather than count pixels.
      ink += 255 - data[i];
    }
    return ink;
  };

  const seen = new Map<number, number>();
  for (const weight of weights) {
    // Round a little so anti-aliasing noise does not read as a real difference.
    const ink = Math.round(inkFor(weight) / 250);
    if (!seen.has(ink)) seen.set(ink, weight);
  }

  const distinct = [...seen.values()].sort((a, b) => a - b);
  cache.set(key, distinct);
  return distinct;
}

/** Clears the cache once webfonts finish loading, since widths change then. */
export function watchFontLoading(onReady: () => void) {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  loadOwnFonts([300, 400, 500, 600, 700, 800, 900])
    .then(() => document.fonts.ready)
    .then(() => {
      cache.clear();
      onReady();
    })
    .catch(() => undefined);
}
