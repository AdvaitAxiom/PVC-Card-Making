"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Download,
  HardDrive,
  RefreshCw,
  Upload,
} from "lucide-react";
import {
  ensureSeeded,
  exportBackup,
  importBackup,
  listCards,
  listTemplates,
  restoreBuiltInTemplates,
} from "@/lib/db";
import { useConfirm } from "@/components/ConfirmDialog";
import ChangePasswordPanel from "@/components/ChangePasswordPanel";
import { downloadBlob, readFileAsText } from "@/lib/utils";

export default function SettingsPage() {
  const confirm = useConfirm();
  const [counts, setCounts] = useState({ templates: 0, cards: 0 });
  const [usage, setUsage] = useState<string>("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function refresh() {
    const [templates, cards] = await Promise.all([listTemplates(), listCards()]);
    setCounts({ templates: templates.length, cards: cards.length });
    if (navigator.storage?.estimate) {
      const estimate = await navigator.storage.estimate();
      if (estimate.usage) setUsage(`${(estimate.usage / 1024 / 1024).toFixed(1)} MB`);
    }
  }

  useEffect(() => {
    ensureSeeded().then(refresh);
  }, []);

  async function handleExport() {
    const backup = await exportBackup();
    const stamp = new Date().toISOString().slice(0, 10);
    downloadBlob(
      new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }),
      `pvc-card-maker-backup-${stamp}.json`,
    );
    setMessage("Backup downloaded. Keep it somewhere safe.");
    setError("");
  }

  async function handleImport(file: File | undefined, mode: "merge" | "replace") {
    if (!file) return;
    try {
      const text = await readFileAsText(file);
      const result = await importBackup(JSON.parse(text), mode);
      await refresh();
      setMessage(
        `Restored ${result.templates} template(s) and ${result.cards} card(s) from the backup.`,
      );
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "That backup file could not be read.");
      setMessage("");
    }
  }

  async function handleReplace(file: File | undefined) {
    if (!file) return;
    const ok = await confirm({
      title: "Replace everything?",
      message:
        "Every template and card currently in this browser will be erased first, then the backup is loaded. This cannot be undone.",
      confirmLabel: "Erase and restore",
      tone: "danger",
    });
    if (!ok) return;
    await handleImport(file, "replace");
  }

  async function handleRestoreBuiltIns() {
    const count = await restoreBuiltInTemplates();
    await refresh();
    setMessage(`Reinstalled ${count} built-in templates.`);
    setError("");
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-7">
      <h1 className="text-2xl font-bold text-slate-900">Backup &amp; storage</h1>
      <p className="mt-1 text-sm text-slate-500">
        Your templates and cards live inside this browser on this computer. Download a backup
        regularly, or to move everything to another computer.
      </p>

      {message ? (
        <p className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="card-panel p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Templates</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{counts.templates}</p>
        </div>
        <div className="card-panel p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Saved cards</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{counts.cards}</p>
        </div>
        <div className="card-panel p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Space used</p>
          <p className="mt-1 flex items-center gap-2 text-2xl font-bold text-slate-900">
            <HardDrive size={20} className="text-slate-400" />
            {usage || "—"}
          </p>
        </div>
      </div>

      <div className="card-panel mt-5 p-5">
        <h2 className="text-sm font-bold text-slate-900">Download a backup</h2>
        <p className="mt-1 text-xs text-slate-500">
          Saves every template (front and back SVG included) and every card into one file.
        </p>
        <button className="btn-primary mt-3" onClick={handleExport}>
          <Download size={16} />
          Download backup file
        </button>
      </div>

      <div className="card-panel mt-4 p-5">
        <h2 className="text-sm font-bold text-slate-900">Restore from a backup</h2>
        <p className="mt-1 text-xs text-slate-500">
          <strong>Merge</strong> adds the backup to what you already have.{" "}
          <strong>Replace</strong> wipes this browser first — use it when moving to a new computer.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <label className="btn-secondary cursor-pointer">
            <Upload size={16} />
            Merge backup
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => handleImport(e.target.files?.[0], "merge")}
            />
          </label>
          <label className="btn-danger cursor-pointer">
            <AlertTriangle size={16} />
            Replace everything
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                handleReplace(file);
              }}
            />
          </label>
        </div>
      </div>

      <div className="card-panel mt-4 p-5">
        <h2 className="text-sm font-bold text-slate-900">Built-in templates</h2>
        <p className="mt-1 text-xs text-slate-500">
          Reloads the cards that ship in the <code className="font-mono">card-templates</code>{" "}
          folder, undoing any edits you made to them. Templates you created yourself are not
          affected.
        </p>
        <button className="btn-secondary mt-3" onClick={handleRestoreBuiltIns}>
          <RefreshCw size={16} />
          Reinstall built-in templates
        </button>
      </div>

      <ChangePasswordPanel />
    </div>
  );
}
