/**
 * Minimal Upstash Redis client over its REST API.
 *
 * Written against fetch directly so the app gains no extra dependency. Works
 * with the variables injected by either the Upstash or Vercel KV integration.
 *
 * When no storage is configured the app still runs — it simply falls back to
 * the APP_USERNAME / APP_PASSWORD environment variables and cannot change them.
 */

function config(): { url: string; token: string } | null {
  const url =
    process.env.KV_REST_API_URL?.trim() || process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token =
    process.env.KV_REST_API_TOKEN?.trim() || process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  return { url: url.replace(/\/+$/, ""), token };
}

export function isStorageConfigured(): boolean {
  return config() !== null;
}

async function command<T>(args: (string | number)[]): Promise<T | null> {
  const cfg = config();
  if (!cfg) return null;

  const response = await fetch(cfg.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Storage request failed (${response.status})`);
  }

  const data = (await response.json()) as { result?: T; error?: string };
  if (data.error) throw new Error(data.error);
  return data.result ?? null;
}

export async function kvGet<T>(key: string): Promise<T | null> {
  const raw = await command<string>(["GET", key]);
  if (raw === null || raw === undefined) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return raw as unknown as T;
  }
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  await command(["SET", key, JSON.stringify(value)]);
}

export async function kvDelete(key: string): Promise<void> {
  await command(["DEL", key]);
}

/** Counts an event in a rolling window, used to slow down guessing. */
export async function kvBumpCounter(key: string, windowSeconds: number): Promise<number> {
  const count = await command<number>(["INCR", key]);
  if (count === 1) await command(["EXPIRE", key, windowSeconds]);
  return count ?? 0;
}
