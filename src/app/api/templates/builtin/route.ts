import { NextRequest, NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

export const runtime = "nodejs";

const ROOT = process.cwd();
const TEMPLATES_DIR = join(ROOT, "card-templates");
const PUBLIC_DIR = join(ROOT, "public");
const BUILT_FILE = join(PUBLIC_DIR, "builtin-templates.json");
const BUILD_SCRIPT = join(ROOT, "scripts", "build-templates.mjs");

/** Card artwork is big, but a single card should never approach this. */
const MAX_BYTES = 12 * 1024 * 1024;

const REQUIRED = ["name", "widthMm", "heightMm", "frontSvg", "backSvg", "fields"];

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Explains why this copy of the app cannot write its own template files.
 *
 * Writable when you run the app on your own computer. A serverless host
 * unpacks the project read-only, so anything written there would vanish with
 * the next request — better to say so than to pretend the card was kept.
 */
async function writeProblem(): Promise<string | null> {
  if (process.env.VERCEL || process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return "The hosted site keeps its own files read-only, so a card cannot be made built-in here. Run the app on your computer, press this button there, then commit and push.";
  }
  try {
    await access(TEMPLATES_DIR, constants.W_OK);
    await access(PUBLIC_DIR, constants.W_OK);
    return null;
  } catch {
    return "The card-templates folder cannot be written to from here. Use Save to app to download the file and move it in yourself.";
  }
}

/** Reruns the same script as `npm run templates`, so the result cannot drift. */
function rebuild(): Promise<void> {
  return new Promise((done, fail) => {
    const child = spawn(process.execPath, [BUILD_SCRIPT], { cwd: ROOT });
    let errorText = "";
    child.stderr.on("data", (chunk) => {
      errorText += String(chunk);
    });
    child.on("error", fail);
    child.on("close", (code) => {
      if (code === 0) done();
      else fail(new Error(errorText.trim() || `build-templates exited with code ${code}`));
    });
  });
}

/**
 * Drops an earlier file for the same card.
 *
 * Renaming a card changes its filename, and without this the folder would
 * end up holding the card twice under two names.
 */
async function removeOlderCopies(id: string, keepFile: string): Promise<void> {
  if (!id) return;
  let entries: string[];
  try {
    entries = await readdir(TEMPLATES_DIR);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry === keepFile || !entry.toLowerCase().endsWith(".json")) continue;
    try {
      const parsed = JSON.parse(await readFile(join(TEMPLATES_DIR, entry), "utf8"));
      // Only ever touch a file holding this one card; a bundle of several
      // could hold other work alongside it.
      if (parsed && !Array.isArray(parsed) && parsed.id === id) {
        await unlink(join(TEMPLATES_DIR, entry));
      }
    } catch {
      // Unreadable or unrelated: leave it exactly where it is.
    }
  }
}

export async function GET() {
  const problem = await writeProblem();
  return NextResponse.json({ writable: problem === null, reason: problem });
}

export async function POST(request: NextRequest) {
  const problem = await writeProblem();
  if (problem) return NextResponse.json({ error: problem }, { status: 503 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const missing = REQUIRED.filter((key) => body?.[key] === undefined);
  if (missing.length) {
    return NextResponse.json(
      { error: `This card is missing ${missing.join(", ")}.` },
      { status: 400 },
    );
  }
  if (!Array.isArray(body.fields)) {
    return NextResponse.json({ error: "This card's details are malformed." }, { status: 400 });
  }
  if (typeof body.frontSvg !== "string" || !body.frontSvg.includes("<svg")) {
    return NextResponse.json({ error: "The front artwork is not an SVG." }, { status: 400 });
  }
  if (typeof body.backSvg !== "string" || !body.backSvg.includes("<svg")) {
    return NextResponse.json({ error: "The back artwork is not an SVG." }, { status: 400 });
  }

  const payload = `${JSON.stringify({ ...body, builtIn: true }, null, 2)}\n`;
  if (Buffer.byteLength(payload) > MAX_BYTES) {
    return NextResponse.json(
      { error: "This card's artwork is too large to save as built-in." },
      { status: 413 },
    );
  }

  const file = `${slug(String(body.name)) || "card"}.json`;
  const target = join(TEMPLATES_DIR, file);
  // The name is already reduced to letters, digits and dashes, so this only
  // guards against that ever being loosened.
  if (!resolve(target).startsWith(resolve(TEMPLATES_DIR))) {
    return NextResponse.json({ error: "That card name cannot be used." }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id : "";

  try {
    await writeFile(target, payload, "utf8");
    await removeOlderCopies(id, file);
    await rebuild();
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `Could not save the card: ${error.message}`
            : "Could not save the card.",
      },
      { status: 500 },
    );
  }

  // Hand back exactly what the build produced, so the browser's copy and the
  // file on disk agree on the fingerprint and do not fight each other later.
  let template: unknown = null;
  try {
    const built = JSON.parse(await readFile(BUILT_FILE, "utf8")) as { id?: string }[];
    template = built.find((entry) => entry.id === id) ?? null;
  } catch {
    // The card is written either way; the browser simply refreshes it later.
  }

  return NextResponse.json({ ok: true, file, template });
}
