/**
 * Builds the app's card templates from the `card-templates/` folder.
 *
 * Two ways to add a card, both without touching code:
 *
 *   1. Drop a matching pair of SVGs:  my-card-front.svg  +  my-card-back.svg
 *   2. Drop a template file exported with "Save to app":  my-card.json
 *
 * A .json always wins over an SVG pair with the same name, so once you have
 * positioned the details and pressed "Save to app" you can delete the SVGs.
 *
 * Runs automatically before `npm run dev` and `npm run build`.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const sourceDir = join(root, "card-templates");
const outFile = join(root, "public", "builtin-templates.json");

const REQUIRED = ["name", "widthMm", "heightMm", "frontSvg", "backSvg", "fields"];

const CR80 = { widthMm: 85.6, heightMm: 54, cornerRadiusMm: 3.18 };

const BLANK_BACK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 856 540">
  <rect width="856" height="540" rx="32" fill="#ffffff"/>
  <rect x="2" y="2" width="852" height="536" rx="30" fill="none" stroke="#cbd5e1" stroke-width="3" stroke-dasharray="10 8"/>
  <text x="428" y="286" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="28" fill="#94a3b8">BACK - add an SVG</text>
</svg>`;

function slug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * A short fingerprint of what the card actually contains.
 *
 * The app compares this against the copy in the browser, so that changing a
 * file here reaches people who already opened the site. It has to depend only
 * on the content — a timestamp would change on every build and rewrite
 * everyone's templates for no reason.
 */
function fingerprint(template) {
  return createHash("sha256")
    .update(template.frontSvg)
    .update(template.backSvg)
    .update(JSON.stringify(template.fields))
    .update(String(template.widthMm))
    .update(String(template.heightMm))
    .update(String(template.name))
    .digest("hex")
    .slice(0, 16);
}

/** Words that should stay in capitals when a filename becomes a card name. */
const ACRONYMS = new Set([
  "rto", "rc", "dl", "id", "noc", "hsrp", "pvc", "uid", "nid", "vin", "qr", "pan",
]);

function titleCase(value) {
  return String(value)
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((word) =>
      ACRONYMS.has(word.toLowerCase())
        ? word.toUpperCase()
        : word.replace(/^\w/, (c) => c.toUpperCase()),
    )
    .join(" ");
}

/** Accepts a single template, an array of them, or a full app backup file. */
function unwrap(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && parsed.kind === "pvc-card-maker-backup") return parsed.templates ?? [];
  if (parsed && typeof parsed === "object") return [parsed];
  return [];
}

function normalise(raw, fallbackId, sourceLabel) {
  const missing = REQUIRED.filter((key) => raw?.[key] === undefined);
  if (missing.length) {
    console.warn(`  ! Skipped a template in ${sourceLabel} - missing: ${missing.join(", ")}`);
    return null;
  }
  if (!Array.isArray(raw.fields)) {
    console.warn(`  ! Skipped "${raw.name}" in ${sourceLabel} - "fields" must be a list`);
    return null;
  }

  const parsedStamp =
    typeof raw.updatedAt === "number" ? raw.updatedAt : Date.parse(raw.updatedAt);
  const stamp = Number.isFinite(parsedStamp) ? parsedStamp : Date.now();

  return {
    ...raw,
    id: raw.id || fallbackId,
    category: raw.category ?? "Custom",
    description: raw.description ?? "",
    cornerRadiusMm: raw.cornerRadiusMm ?? CR80.cornerRadiusMm,
    builtIn: true,
    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : stamp,
    updatedAt: stamp,
  };
}

function collect() {
  if (!existsSync(sourceDir)) return [];

  const entries = readdirSync(sourceDir);
  const templates = [];
  const takenIds = new Set();

  // ---- 1. Template files (.json) take priority -------------------------------
  for (const file of entries.filter((f) => f.toLowerCase().endsWith(".json")).sort()) {
    let parsed;
    try {
      parsed = JSON.parse(readFileSync(join(sourceDir, file), "utf8"));
    } catch (error) {
      console.warn(`  ! Skipped ${file} - it is not valid JSON (${error.message})`);
      continue;
    }
    for (const raw of unwrap(parsed)) {
      const normalised = normalise(raw, `tpl_${slug(basename(file, ".json"))}`, file);
      if (!normalised) continue;
      while (takenIds.has(normalised.id)) normalised.id = `${normalised.id}_2`;
      takenIds.add(normalised.id);
      templates.push(normalised);
      console.log(`  + ${normalised.name}  (${normalised.fields.length} details, ${file})`);
    }
  }

  // ---- 2. Raw SVG pairs ------------------------------------------------------
  const svgs = entries.filter((f) => f.toLowerCase().endsWith(".svg"));
  const pairs = new Map();

  for (const file of svgs) {
    const match = /^(.*?)[-_ ]*(front|back)\.svg$/i.exec(file);
    if (!match) {
      console.warn(
        `  ! Ignored ${file} - name it "<card>-front.svg" and "<card>-back.svg" so they pair up`,
      );
      continue;
    }
    const [, base, sideRaw] = match;
    const key = base.replace(/[-_ ]+$/, "");
    if (!pairs.has(key)) pairs.set(key, {});
    pairs.get(key)[sideRaw.toLowerCase()] = file;
  }

  for (const [base, sides] of [...pairs.entries()].sort()) {
    const id = `tpl_${slug(base)}`;
    if (takenIds.has(id)) {
      console.log(`  . Using the .json for "${titleCase(base)}" (SVG pair ignored)`);
      continue;
    }
    if (!sides.front) {
      console.warn(`  ! Skipped "${base}" - no <card>-front.svg found`);
      continue;
    }

    const frontSvg = readFileSync(join(sourceDir, sides.front), "utf8");
    const backSvg = sides.back ? readFileSync(join(sourceDir, sides.back), "utf8") : BLANK_BACK;
    if (!sides.back) {
      console.warn(`  ! "${base}" has no back SVG - using a blank back for now`);
    }

    const now = Date.now();
    takenIds.add(id);
    templates.push({
      id,
      name: titleCase(base),
      category: "Custom",
      description: `Built from ${sides.front}${sides.back ? ` and ${sides.back}` : ""}.`,
      widthMm: CR80.widthMm,
      heightMm: CR80.heightMm,
      cornerRadiusMm: CR80.cornerRadiusMm,
      frontSvg,
      backSvg,
      fields: [],
      builtIn: true,
      createdAt: now,
      updatedAt: now,
    });
    console.log(
      `  + ${titleCase(base)}  (from ${sides.front}${sides.back ? ` + ${sides.back}` : ""})`,
    );
  }

  return templates;
}

console.log("Building card templates from card-templates/ ...");
const templates = collect();

// Stamp each one so the app can tell when a card has actually changed.
for (const template of templates) {
  template.contentHash = fingerprint(template);
}

mkdirSync(dirname(outFile), { recursive: true });
const payload = JSON.stringify(templates);
writeFileSync(outFile, payload);

if (templates.length === 0) {
  console.log("  (no templates found - the app will start empty and prompt you to add one)");
}
console.log(
  `Done: ${templates.length} built-in template(s), ${Math.round(payload.length / 1024)} KB.`,
);
