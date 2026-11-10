"use client";

import { IDBPDatabase, openDB } from "idb";
import { loadSeedTemplates } from "./seed-templates";
import { BackupFile, CardRecord, CardTemplate } from "./types";
import { uid } from "./utils";

const DB_NAME = "pvc-card-maker";
const DB_VERSION = 2;
const TEMPLATES = "templates";
const CARDS = "cards";
const META = "meta";

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb() {
  if (typeof window === "undefined") {
    throw new Error("The local card library is only available in the browser.");
  }
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(TEMPLATES)) {
          db.createObjectStore(TEMPLATES, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(CARDS)) {
          db.createObjectStore(CARDS, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(META)) {
          db.createObjectStore(META);
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Brings the browser in line with the templates shipped in `card-templates/`.
 *
 * Adds cards that are missing, refreshes ones whose artwork has changed, and
 * removes built-ins whose file has been deleted. Templates you created
 * yourself are never touched.
 */
export async function ensureSeeded(): Promise<void> {
  const db = await getDb();
  const seeds = await loadSeedTemplates();
  const seedIds = new Set(seeds.map((t) => t.id));

  const existing = (await db.getAll(TEMPLATES)) as CardTemplate[];
  const existingById = new Map(existing.map((t) => [t.id, t]));

  const stale = existing.filter((t) => t.builtIn && !seedIds.has(t.id));

  // A card counts as changed when its fingerprint no longer matches. Cards
  // built before fingerprints existed have none, so they are refreshed once.
  const changed = seeds.filter((seed) => {
    const mine = existingById.get(seed.id);
    if (!mine) return true;
    return mine.contentHash !== seed.contentHash;
  });

  if (stale.length === 0 && changed.length === 0) {
    await db.put(META, true, "seeded");
    return;
  }

  const tx = db.transaction(TEMPLATES, "readwrite");
  for (const template of stale) {
    await tx.store.delete(template.id);
  }
  for (const template of changed) {
    await tx.store.put(template);
  }
  await tx.done;
  await db.put(META, true, "seeded");
}

export async function listTemplates(): Promise<CardTemplate[]> {
  const db = await getDb();
  const all = (await db.getAll(TEMPLATES)) as CardTemplate[];
  return all.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getTemplate(id: string): Promise<CardTemplate | undefined> {
  const db = await getDb();
  return (await db.get(TEMPLATES, id)) as CardTemplate | undefined;
}

export async function saveTemplate(template: CardTemplate): Promise<CardTemplate> {
  const db = await getDb();
  const next = { ...template, updatedAt: Date.now() };
  await db.put(TEMPLATES, next);
  return next;
}

export async function deleteTemplate(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(TEMPLATES, id);
}

export async function duplicateTemplate(id: string): Promise<CardTemplate | undefined> {
  const source = await getTemplate(id);
  if (!source) return undefined;
  const copy: CardTemplate = {
    ...structuredClone(source),
    id: uid("tpl"),
    name: `${source.name} (copy)`,
    builtIn: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  copy.fields = copy.fields.map((f) => ({ ...f, id: uid("fld") }));
  return saveTemplate(copy);
}

export async function listCards(): Promise<CardRecord[]> {
  const db = await getDb();
  const all = (await db.getAll(CARDS)) as CardRecord[];
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getCard(id: string): Promise<CardRecord | undefined> {
  const db = await getDb();
  return (await db.get(CARDS, id)) as CardRecord | undefined;
}

export async function saveCard(card: CardRecord): Promise<CardRecord> {
  const db = await getDb();
  const next = { ...card, updatedAt: Date.now() };
  await db.put(CARDS, next);
  return next;
}

export async function deleteCard(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(CARDS, id);
}

export async function createCardFromTemplate(template: CardTemplate): Promise<CardRecord> {
  const values: Record<string, string> = {};
  for (const field of template.fields) {
    // Only text needs a per-card value; pictures and lines stay on the template.
    if (field.defaultValue && field.type === "text") values[field.key] = field.defaultValue;
  }
  const card: CardRecord = {
    id: uid("card"),
    templateId: template.id,
    title: "Untitled card",
    values,
    overrides: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  return saveCard(card);
}

export async function exportBackup(): Promise<BackupFile> {
  const [templates, cards] = await Promise.all([listTemplates(), listCards()]);
  return {
    kind: "pvc-card-maker-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    templates,
    cards,
  };
}

export async function importBackup(
  data: unknown,
  mode: "merge" | "replace" = "merge",
): Promise<{ templates: number; cards: number }> {
  const backup = data as BackupFile;
  if (!backup || backup.kind !== "pvc-card-maker-backup" || !Array.isArray(backup.templates)) {
    throw new Error("That file is not a PVC Card Maker backup.");
  }
  const db = await getDb();
  if (mode === "replace") {
    await db.clear(TEMPLATES);
    await db.clear(CARDS);
  }
  const tx = db.transaction([TEMPLATES, CARDS], "readwrite");
  for (const template of backup.templates) {
    await tx.objectStore(TEMPLATES).put(template);
  }
  for (const card of backup.cards ?? []) {
    await tx.objectStore(CARDS).put(card);
  }
  await tx.done;
  await db.put(META, true, "seeded");
  return { templates: backup.templates.length, cards: backup.cards?.length ?? 0 };
}

export async function restoreBuiltInTemplates(): Promise<number> {
  const db = await getDb();
  const seeds = await loadSeedTemplates();
  const tx = db.transaction(TEMPLATES, "readwrite");
  for (const template of seeds) {
    await tx.store.put(template);
  }
  await tx.done;
  return seeds.length;
}
