import { NextResponse } from "next/server";
import { isStorageConfigured, recoveryKey } from "@/lib/credentials";

export const runtime = "nodejs";

/** Lets the UI show only the options that are actually available. */
export async function GET() {
  return NextResponse.json({
    storage: isStorageConfigured(),
    recovery: recoveryKey() !== null,
  });
}
