import { NextRequest, NextResponse } from "next/server";
import {
  currentUsername,
  isStorageConfigured,
  passwordProblem,
  recoveryKey,
  safeEqual,
  saveCredentials,
} from "@/lib/credentials";
import { kvBumpCounter } from "@/lib/kv";

export const runtime = "nodejs";

const MAX_ATTEMPTS = 5;
const WINDOW_SECONDS = 60 * 60;

/**
 * Resets the password without being signed in.
 *
 * Gated by RECOVERY_KEY, which only the owner knows. Without that, anyone who
 * found the site could simply take it over.
 */
export async function POST(request: NextRequest) {
  if (!isStorageConfigured()) {
    return NextResponse.json(
      {
        error:
          "No storage is connected yet, so the password cannot be reset here. Change APP_PASSWORD in your hosting settings instead.",
      },
      { status: 503 },
    );
  }

  const expectedKey = recoveryKey();
  if (!expectedKey) {
    return NextResponse.json(
      {
        error:
          "No recovery key has been set up. Add a RECOVERY_KEY environment variable, then redeploy.",
      },
      { status: 503 },
    );
  }

  let body: { recoveryKey?: string; newPassword?: string; newUsername?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // Recovery is the most sensitive route here, so guard it tightly.
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const attempts = await kvBumpCounter(`pvc:reset-attempts:${ip}`, WINDOW_SECONDS);
    if (attempts > MAX_ATTEMPTS) {
      return NextResponse.json(
        { error: "Too many attempts. Please wait an hour and try again." },
        { status: 429 },
      );
    }
  } catch {
    // Counter problems must not open the door, but must not wrongly close it either.
  }

  const supplied = (body.recoveryKey ?? "").trim();
  if (!safeEqual(supplied, expectedKey)) {
    await new Promise((resolve) => setTimeout(resolve, 900));
    return NextResponse.json({ error: "That recovery key is not right." }, { status: 403 });
  }

  const newPassword = body.newPassword ?? "";
  const problem = passwordProblem(newPassword);
  if (problem) {
    return NextResponse.json({ error: problem }, { status: 400 });
  }

  const newUsername = (body.newUsername ?? "").trim() || (await currentUsername());
  if (newUsername.length < 3) {
    return NextResponse.json(
      { error: "The username needs at least 3 characters." },
      { status: 400 },
    );
  }

  try {
    await saveCredentials(newUsername, newPassword);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save the new password." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, username: newUsername });
}
