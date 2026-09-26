import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  authConfigProblem,
  createSessionToken,
} from "@/lib/auth";
import { currentUsername, verifyCredentials } from "@/lib/credentials";
import { isStorageConfigured, kvBumpCounter } from "@/lib/kv";

export const runtime = "nodejs";

const MAX_ATTEMPTS = 10;
const WINDOW_SECONDS = 15 * 60;

export async function POST(request: NextRequest) {
  // A deployment that was never configured must say so plainly, rather than
  // quietly accept the development password that is public in this source.
  const configProblem = authConfigProblem();
  if (configProblem) {
    return NextResponse.json({ error: configProblem }, { status: 503 });
  }

  let body: { username?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const username = (body.username ?? "").trim();
  const password = body.password ?? "";

  // Slow down repeated guessing, when storage is available to count with.
  if (isStorageConfigured()) {
    try {
      const ip =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
      const attempts = await kvBumpCounter(`pvc:login-attempts:${ip}`, WINDOW_SECONDS);
      if (attempts > MAX_ATTEMPTS) {
        return NextResponse.json(
          { error: "Too many attempts. Please wait 15 minutes and try again." },
          { status: 429 },
        );
      }
    } catch {
      // Never block a legitimate sign-in because the counter failed.
    }
  }

  // Only reached when there is no stored password to fall back from, so this
  // is where a missing APP_PASSWORD surfaces.
  let ok: boolean;
  try {
    ok = await verifyCredentials(username, password);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Sign-in is not configured yet.",
      },
      { status: 503 },
    );
  }

  if (!ok) {
    await new Promise((resolve) => setTimeout(resolve, 600));
    return NextResponse.json(
      { error: "Wrong username or password. Please try again." },
      { status: 401 },
    );
  }

  const name = await currentUsername();
  const token = await createSessionToken(name);
  const response = NextResponse.json({ ok: true, username: name });

  // Only mark the cookie secure over HTTPS, so `npm start` on plain localhost still works.
  const proto =
    request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: proto === "https",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}
