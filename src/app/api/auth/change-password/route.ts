import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import {
  currentUsername,
  isStorageConfigured,
  passwordProblem,
  saveCredentials,
  verifyCredentials,
} from "@/lib/credentials";

export const runtime = "nodejs";

/** Changes the password for someone who is already signed in. */
export async function POST(request: NextRequest) {
  const signedInAs = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (!signedInAs) {
    return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  }

  if (!isStorageConfigured()) {
    return NextResponse.json(
      {
        error:
          "No storage is connected yet, so the password cannot be changed here. See the README for the one-off Upstash setup.",
      },
      { status: 503 },
    );
  }

  let body: { currentPassword?: string; newPassword?: string; newUsername?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const username = await currentUsername();
  const currentOk = await verifyCredentials(username, body.currentPassword ?? "");
  if (!currentOk) {
    await new Promise((resolve) => setTimeout(resolve, 600));
    return NextResponse.json(
      { error: "Your current password is not right." },
      { status: 403 },
    );
  }

  const newPassword = body.newPassword ?? "";
  const problem = passwordProblem(newPassword);
  if (problem) {
    return NextResponse.json({ error: problem }, { status: 400 });
  }

  const newUsername = (body.newUsername ?? "").trim() || username;
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

  // Force a fresh sign-in with the new details.
  const response = NextResponse.json({ ok: true, username: newUsername });
  response.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
