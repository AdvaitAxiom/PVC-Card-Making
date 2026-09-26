import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "pvc_session";
const SESSION_HOURS = 12;

/**
 * Used only when running locally, so a fresh checkout starts with no setup.
 *
 * A deployment must bring its own secret. Falling back to a built-in one in
 * production would let anyone holding this source sign their own session
 * cookie and walk straight past the login — and no password change could
 * undo that, because the cookie is trusted on its signature alone.
 */
const DEV_SECRET = "pvc-card-maker-development-only-secret-never-deploy-this";

const MIN_SECRET_LENGTH = 32;

function inProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Says what is missing before sessions can be trusted, or null when all is well. */
export function authConfigProblem(): string | null {
  if (!inProduction()) return null;

  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret) {
    return "AUTH_SECRET is not set, so sign-in is switched off. Add it in your hosting settings and redeploy.";
  }
  if (secret.length < MIN_SECRET_LENGTH) {
    return `AUTH_SECRET is too short. Use at least ${MIN_SECRET_LENGTH} characters, then redeploy.`;
  }
  if (secret === DEV_SECRET) {
    return "AUTH_SECRET is still the development value. Replace it with a long random string, then redeploy.";
  }
  return null;
}

function secretKey(): Uint8Array {
  const problem = authConfigProblem();
  if (problem) throw new Error(problem);
  return new TextEncoder().encode(process.env.AUTH_SECRET?.trim() || DEV_SECRET);
}

export async function createSessionToken(username: string): Promise<string> {
  return new SignJWT({ username })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  try {
    // secretKey() throwing lands here too, so a misconfigured deployment
    // treats every caller as signed out rather than letting anyone in.
    const { payload } = await jwtVerify(token, secretKey());
    return typeof payload.username === "string" ? payload.username : null;
  } catch {
    return null;
  }
}

export const SESSION_MAX_AGE = SESSION_HOURS * 60 * 60;
