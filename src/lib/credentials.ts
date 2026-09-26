import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { isStorageConfigured, kvGet, kvSet } from "./kv";

/**
 * Where the live credentials live.
 *
 * The environment variables are the starting point. Once the password is
 * changed it is stored — hashed — in Upstash, and that stored value wins.
 */

const CREDENTIALS_KEY = "pvc:credentials";

export interface StoredCredentials {
  username: string;
  salt: string;
  hash: string;
  updatedAt: number;
}

/**
 * The sign-in details a deployment was configured with.
 *
 * Values are trimmed because pasting into a hosting dashboard very easily
 * leaves a trailing space or newline, which would otherwise silently stop the
 * password from ever matching.
 *
 * The built-in pair is a local-development convenience only. It is published
 * in this repository, so allowing it in production would leave the site open
 * to anyone who has read the source.
 */
export function envCredentials() {
  const username = process.env.APP_USERNAME?.trim();
  const password = process.env.APP_PASSWORD?.trim();

  if (process.env.NODE_ENV === "production" && (!username || !password)) {
    throw new Error(
      "APP_USERNAME and APP_PASSWORD are not set, so sign-in is switched off. Add them in your hosting settings and redeploy.",
    );
  }

  return {
    username: username || "admin",
    password: password || "pvc2024",
  };
}

/** The same check without the throw, for telling the user what to fix. */
export function credentialsConfigProblem(): string | null {
  try {
    envCredentials();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Sign-in is not configured.";
  }
}

export function recoveryKey(): string | null {
  const key = process.env.RECOVERY_KEY?.trim();
  return key && key.length > 0 ? key : null;
}

function scryptAsync(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, 64, (err, derived) => {
      if (err) reject(err);
      else resolve(derived);
    });
  });
}

export async function hashPassword(password: string, salt?: string) {
  const useSalt = salt ?? randomBytes(16).toString("hex");
  const derived = await scryptAsync(password, useSalt);
  return { salt: useSalt, hash: derived.toString("hex") };
}

/** Compares two strings without leaking how much of them matched. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Still do a comparison so the timing stays roughly constant.
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

async function readStored(): Promise<StoredCredentials | null> {
  if (!isStorageConfigured()) return null;
  try {
    return await kvGet<StoredCredentials>(CREDENTIALS_KEY);
  } catch {
    return null;
  }
}

/** The username currently in force. Never throws: a username is not a secret. */
export async function currentUsername(): Promise<string> {
  const stored = await readStored();
  if (stored) return stored.username;
  return process.env.APP_USERNAME?.trim() || "admin";
}

export async function verifyCredentials(
  username: string,
  password: string,
): Promise<boolean> {
  const stored = await readStored();

  if (stored) {
    const userOk = safeEqual(username.trim().toLowerCase(), stored.username.toLowerCase());
    const { hash } = await hashPassword(password, stored.salt);
    const passOk = safeEqual(hash, stored.hash);
    return userOk && passOk;
  }

  const expected = envCredentials();
  const userOk = safeEqual(username.trim().toLowerCase(), expected.username.toLowerCase());
  const passOk = safeEqual(password, expected.password);
  return userOk && passOk;
}

export async function saveCredentials(username: string, password: string): Promise<void> {
  if (!isStorageConfigured()) {
    throw new Error(
      "No storage is connected, so the password cannot be changed here. Add an Upstash database in Vercel, or change APP_PASSWORD in your project settings.",
    );
  }
  const { salt, hash } = await hashPassword(password);
  const record: StoredCredentials = {
    username: username.trim(),
    salt,
    hash,
    updatedAt: Date.now(),
  };
  await kvSet(CREDENTIALS_KEY, record);
}

export function passwordProblem(password: string): string | null {
  if (password.length < 8) return "Use at least 8 characters.";
  if (password.length > 200) return "That password is too long.";
  if (!/[a-zA-Z]/.test(password)) return "Include at least one letter.";
  if (!/[0-9]/.test(password)) return "Include at least one number.";
  return null;
}

export { isStorageConfigured };
