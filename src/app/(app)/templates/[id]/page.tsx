"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Copy,
  Crop as CropIcon,
  Download,
  Image as ImageIcon,
  ImagePlus,
  Info,
  Layers,
  ListPlus,
  Loader2,
  Lock,
  LockOpen,
  Minus,
  PackagePlus,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Redo2,
  Shapes,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Type,
  Undo2,
  Upload,
  WandSparkles,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import CardCanvas from "@/components/CardCanvas";
import ImageCropper from "@/components/ImageCropper";
import StylePanel from "@/components/StylePanel";
import { useConfirm } from "@/components/ConfirmDialog";
import {
  CardTemplate,
  DEFAULT_STYLE,
  FieldLayout,
  FieldStyle,
  FieldType,
  Side,
  TemplateField,
} from "@/lib/types";
import { getTemplate, saveTemplate } from "@/lib/db";
import { sanitizeSvg } from "@/lib/render";
import { countSvgText, extractTextFields, stripTextFromSvg } from "@/lib/import-text";
import { readImageScaled } from "@/lib/image";
import { arrowDelta, isTypingTarget, nudgeStep } from "@/lib/shortcuts";
import { cx, downloadBlob, readFileAsText, round, slugKey, uid } from "@/lib/utils";

export default function TemplateDesignerPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const confirm = useConfirm();
  const templateId = params?.id;

  const [template, setTemplate] = useState<CardTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [side, setSide] = useState<Side>("front");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(7);
  const [saved, setSaved] = useState(true);
  const [toast, setToast] = useState("");
  const [showSvgCode, setShowSvgCode] = useState(false);
  const [showSaveHelp, setShowSaveHelp] = useState(false);
  const [savingBuiltIn, setSavingBuiltIn] = useState(false);
  const [canSaveBuiltIn, setCanSaveBuiltIn] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [showProperties, setShowProperties] = useState(false);
  const [panel, setPanel] = useState<"info" | "artwork" | "details" | null>("details");
  const [cropFor, setCropFor] = useState<
    { id: string; src: string; aspect?: number } | null
  >(null);
  const canvasAreaRef = useRef<HTMLDivElement>(null);

  const PANELS = [
    { id: "info" as const, icon: Info, label: "Info" },
    { id: "artwork" as const, icon: Shapes, label: "Artwork" },
    { id: "details" as const, icon: Layers, label: "Details" },
  ];

  /** On a narrow window the side panel would squeeze the card, so start closed. */
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 1100) setPanel(null);
  }, []);
  const [bulkText, setBulkText] = useState("");
  const firstLoad = useRef(true);

  // --- Undo / redo -----------------------------------------------------------
  const past = useRef<CardTemplate[]>([]);
  const future = useRef<CardTemplate[]>([]);
  const lastSnapshot = useRef<CardTemplate | null>(null);
  const timeTravelling = useRef(false);
  const snapshotTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [historyTick, setHistoryTick] = useState(0);

  const undo = useCallback(() => {
    if (snapshotTimer.current) {
      clearTimeout(snapshotTimer.current);
      snapshotTimer.current = null;
    }
    if (!template || past.current.length === 0) return;
    const previous = past.current.pop()!;
    future.current.push(template);
    lastSnapshot.current = previous;
    timeTravelling.current = true;
    setTemplate(previous);
    setHistoryTick((t) => t + 1);
  }, [template]);

  const redo = useCallback(() => {
    if (snapshotTimer.current) {
      clearTimeout(snapshotTimer.current);
      snapshotTimer.current = null;
    }
    if (!template || future.current.length === 0) return;
    const next = future.current.pop()!;
    past.current.push(template);
    lastSnapshot.current = next;
    timeTravelling.current = true;
    setTemplate(next);
    setHistoryTick((t) => t + 1);
  }, [template]);

  /** Remembers the state before each edit so it can be undone. */
  useEffect(() => {
    if (!template || loading) return;
    if (lastSnapshot.current === null) {
      lastSnapshot.current = template;
      return;
    }
    if (timeTravelling.current) {
      timeTravelling.current = false;
      return;
    }
    if (template === lastSnapshot.current) return;

    if (snapshotTimer.current) clearTimeout(snapshotTimer.current);
    snapshotTimer.current = setTimeout(() => {
      const before = lastSnapshot.current;
      if (before && before !== template) {
        past.current.push(before);
        if (past.current.length > 60) past.current.shift();
        future.current = [];
        lastSnapshot.current = template;
        setHistoryTick((t) => t + 1);
      }
      snapshotTimer.current = null;
    }, 400);

    return () => {
      if (snapshotTimer.current) clearTimeout(snapshotTimer.current);
    };
  }, [template, loading]);

  useEffect(() => {
    if (!templateId) return;
    getTemplate(templateId)
      .then((found) => {
        if (!found) setNotFound(true);
        else setTemplate(found);
      })
      .finally(() => setLoading(false));
  }, [templateId]);

  useEffect(() => {
    if (!template || loading) return;
    if (firstLoad.current) {
      firstLoad.current = false;
      return;
    }
    setSaved(false);
    const timer = setTimeout(() => {
      saveTemplate(template).then(() => setSaved(true));
    }, 500);
    return () => clearTimeout(timer);
  }, [template, loading]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2800);
    return () => clearTimeout(timer);
  }, [toast]);

  /** Only offer the one-press option where the app can write its own files. */
  useEffect(() => {
    let alive = true;
    fetch("/api/templates/builtin")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (alive && data) setCanSaveBuiltIn(Boolean(data.writable));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const selectedField = useMemo(
    () => template?.fields.find((f) => f.id === selectedId) ?? null,
    [template, selectedId],
  );

  const artworkTextCount = useMemo(() => {
    if (!template) return 0;
    return countSvgText(side === "front" ? template.frontSvg : template.backSvg);
  }, [template, side]);

  /** Picks the largest zoom that still shows the whole card. */
  const fitToView = useCallback(() => {
    const area = canvasAreaRef.current;
    if (!area || !template) return;
    const pad = 48;
    const byWidth = (area.clientWidth - pad) / template.widthMm;
    const byHeight = (area.clientHeight - pad) / template.heightMm;
    setZoom(Math.max(3, Math.min(16, Math.round(Math.min(byWidth, byHeight) * 2) / 2)));
  }, [template]);

  /** Size the card to the space once it is on screen, and on window resize. */
  useEffect(() => {
    if (loading || !template) return;
    const id = setTimeout(fitToView, 120);
    window.addEventListener("resize", fitToView);
    return () => {
      clearTimeout(id);
      window.removeEventListener("resize", fitToView);
    };
  }, [loading, template, panel, fitToView]);

  const patchField = useCallback((fieldId: string, patch: Partial<TemplateField>) => {
    setTemplate((prev) =>
      prev
        ? {
            ...prev,
            fields: prev.fields.map((f) => (f.id === fieldId ? { ...f, ...patch } : f)),
          }
        : prev,
    );
  }, []);

  const patchLayout = useCallback(
    (fieldId: string, patch: Partial<FieldLayout>) => {
      setTemplate((prev) =>
        prev
          ? {
              ...prev,
              fields: prev.fields.map((f) =>
                f.id === fieldId ? { ...f, layout: { ...f.layout, ...patch } } : f,
              ),
            }
          : prev,
      );
    },
    [],
  );

  const patchStyle = useCallback((fieldId: string, patch: Partial<FieldStyle>) => {
    setTemplate((prev) =>
      prev
        ? {
            ...prev,
            fields: prev.fields.map((f) =>
              f.id === fieldId ? { ...f, style: { ...f.style, ...patch } } : f,
            ),
          }
        : prev,
    );
  }, []);

  function addField(type: FieldType) {
    if (!template) return;
    const field: TemplateField = {
      id: uid("fld"),
      key: "",
      label: "",
      type,
      side,
      required: false,
      multiline: false,
      placeholder: type === "text" ? "Type here" : "",
      defaultValue: "",
      helpText: "",
      layout:
        type === "image"
          ? { x: 8, y: 14, width: 20, height: 25, rotation: 0 }
          : { x: 10, y: 24, width: 45, height: type === "line" ? 0.4 : 6, rotation: 0 },
      style: { ...DEFAULT_STYLE, imageFit: type === "image" ? "cover" : DEFAULT_STYLE.imageFit },
      locked: false,
    };
    setTemplate((prev) => {
      if (!prev) return prev;
      const count = prev.fields.length + 1;
      return {
        ...prev,
        fields: [
          ...prev.fields,
          {
            ...field,
            key: `field_${count}`,
            label: type === "image" ? `Image ${count}` : type === "line" ? `Line ${count}` : `Detail ${count}`,
          },
        ],
      };
    });
    setSelectedId(field.id);
  }

  function duplicateField(fieldId: string) {
    const newId = uid("fld");
    setTemplate((prev) => {
      if (!prev) return prev;
      const source = prev.fields.find((f) => f.id === fieldId);
      if (!source) return prev;
      const copy: TemplateField = {
        ...structuredClone(source),
        id: newId,
        key: `${source.key}_copy`,
        label: `${source.label} (copy)`,
        layout: { ...source.layout, x: source.layout.x + 2, y: source.layout.y + 2 },
      };
      return { ...prev, fields: [...prev.fields, copy] };
    });
    setSelectedId(newId);
  }

  /** Undo covers this now, so it deletes straight away rather than asking. */
  const removeField = useCallback(
    (fieldId: string) => {
      const gone = template?.fields.find((f) => f.id === fieldId);
      setTemplate((prev) =>
        prev ? { ...prev, fields: prev.fields.filter((f) => f.id !== fieldId) } : prev,
      );
      setSelectedId((current) => (current === fieldId ? null : current));
      if (gone) setToast(`Removed "${gone.label}". Press Ctrl+Z to bring it back.`);
    },
    [template],
  );

  /** Moves the selected detail, so arrow keys work wherever focus happens to be. */
  const nudgeSelected = useCallback(
    (dx: number, dy: number) => {
      if (!selectedId || !template) return;
      const field = template.fields.find((f) => f.id === selectedId);
      if (!field || field.locked) return;
      patchLayout(field.id, {
        x: round(field.layout.x + dx, 2),
        y: round(field.layout.y + dy, 2),
      });
    },
    [selectedId, template, patchLayout],
  );

  /** Keyboard shortcuts: Delete removes the selection, Ctrl+Z steps back. */
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const typing = isTypingTarget(event.target);
      const combo = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      if (combo && key === "z") {
        if (typing) return;
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (combo && key === "y") {
        if (typing) return;
        event.preventDefault();
        redo();
        return;
      }

      if (typing) return;

      if (event.key === "Escape") {
        setSelectedId(null);
        return;
      }

      if (!selectedId) return;

      if (event.key === "Delete" || event.key === "Backspace") {
        const field = template?.fields.find((f) => f.id === selectedId);
        if (!field) return;
        event.preventDefault();
        if (field.locked) {
          setToast(`"${field.label}" is locked. Unlock it first.`);
          return;
        }
        removeField(selectedId);
        return;
      }

      const dir = arrowDelta(event.key);
      if (dir) {
        event.preventDefault();
        const step = nudgeStep(event);
        nudgeSelected(dir.dx * step, dir.dy * step);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedId, template, undo, redo, removeField, nudgeSelected]);

  /** Turns the words already drawn in the artwork into editable, draggable details. */
  async function importArtworkText() {
    if (!template) return;
    const surface = document.querySelector<HTMLElement>(
      `[data-card-surface="design-${template.id}"]`,
    );
    if (!surface) {
      setToast("Could not read the preview. Try again in a moment.");
      return;
    }

    const found = extractTextFields(
      surface,
      template.widthMm,
      side,
      template.fields.map((f) => f.key),
    );

    if (found.length === 0) {
      setToast(
        "No text found in this artwork — it was most likely flattened into a picture when it was exported.",
      );
      return;
    }

    const ok = await confirm({
      title: `Import ${found.length} text item${found.length === 1 ? "" : "s"}?`,
      message:
        `They will become details you can type into, drag and restyle, and will be taken out ` +
        `of the background so nothing appears twice.\n\n` +
        `Delete any you don't need afterwards, or re-upload the SVG to start over.`,
      confirmLabel: "Import",
    });
    if (!ok) return;

    setTemplate((prev) =>
      prev
        ? ({
            ...prev,
            [side === "front" ? "frontSvg" : "backSvg"]: stripTextFromSvg(
              side === "front" ? prev.frontSvg : prev.backSvg,
            ),
            fields: [...prev.fields, ...found],
          } as CardTemplate)
        : prev,
    );
    setSelectedId(found[0].id);
    setToast(`Imported ${found.length} text item${found.length === 1 ? "" : "s"}.`);
  }

  /** Stores a picture that ships with the template — a logo, emblem or hologram. */
  async function uploadDefaultImage(fieldId: string, file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setToast("Please choose an image file (PNG, JPG, SVG or WebP).");
      return;
    }
    try {
      const dataUrl = await readImageScaled(file);
      patchField(fieldId, { defaultValue: dataUrl });
      setSelectedId(fieldId);
      setToast("Image added to the template.");
    } catch {
      setToast("Sorry, that image could not be read.");
    }
  }

  function addFieldsFromList(raw: string) {
    const labels = raw
      .split("\n")
      .map((line) => line.replace(/^\s*[-*\d.)]+\s*/, "").trim())
      .filter(Boolean);
    if (labels.length === 0) return;

    setTemplate((prev) => {
      if (!prev) return prev;
      const used = new Set(prev.fields.map((f) => f.key));
      const created = labels.map((label, index) => {
        let key = slugKey(label).slice(0, 26) || `field_${index + 1}`;
        let n = 2;
        while (used.has(key)) key = `${slugKey(label).slice(0, 24)}_${n++}`;
        used.add(key);

        // Stack them in tidy columns so every one is reachable to drag.
        const perColumn = 7;
        const column = Math.floor(index / perColumn);
        const row = index % perColumn;

        return {
          id: uid("fld"),
          key,
          label,
          type: "text" as FieldType,
          side,
          required: false,
          multiline: false,
          placeholder: label,
          defaultValue: "",
          helpText: "",
          layout: {
            x: 4 + column * 40,
            y: 6 + row * 6.5,
            width: 36,
            height: 5,
            rotation: 0,
          },
          style: { ...DEFAULT_STYLE, fontSize: 7, fontWeight: 600 },
          locked: false,
        };
      });
      return { ...prev, fields: [...prev.fields, ...created] };
    });

    setBulkText("");
    setShowBulk(false);
    setToast(`Added ${labels.length} details — drag each one onto the card.`);
  }

  /**
   * Writes this card straight into `card-templates/`, so it survives the
   * browser being cleared. Only possible when the app runs on your own
   * computer — the hosted site cannot write to its own files.
   */
  async function saveAsBuiltIn() {
    if (!template || savingBuiltIn) return;
    setSavingBuiltIn(true);
    try {
      const response = await fetch("/api/templates/builtin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(template),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setCanSaveBuiltIn(response.status !== 503);
        setToast(data.error ?? "Could not save this card as built-in.");
        return;
      }

      if (data.template) {
        const stored = await saveTemplate(data.template as CardTemplate);
        // A bookkeeping update, not an edit: keep it out of the undo history.
        lastSnapshot.current = stored;
        timeTravelling.current = true;
        setTemplate(stored);
      }
      setToast(`Kept for good in card-templates/${data.file}`);
    } catch {
      setToast("Could not reach the app to save this card as built-in.");
    } finally {
      setSavingBuiltIn(false);
    }
  }

  /** Exports this template as a file to drop into the card-templates/ folder. */
  function saveToApp() {
    if (!template) return;
    const payload = { ...template, builtIn: true };
    const safeName = template.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "card";
    downloadBlob(
      new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }),
      `${safeName}.json`,
    );
    setShowSaveHelp(true);
    setPanel("info");
  }

  async function uploadSvg(targetSide: Side, file: File | undefined) {    if (!file || !template) return;
    const text = await readFileAsText(file);
    if (!text.includes("<svg")) {
      setToast("That file does not look like an SVG.");
      return;
    }
    const clean = sanitizeSvg(text, `u${Date.now().toString(36)}`);
    setTemplate((prev) =>
      prev
        ? ({
            ...prev,
            [targetSide === "front" ? "frontSvg" : "backSvg"]: clean,
          } as CardTemplate)
        : prev,
    );
    setSide(targetSide);
    setToast(`${targetSide === "front" ? "Front" : "Back"} artwork updated.`);
  }

  function downloadSvg(targetSide: Side) {
    if (!template) return;
    const svg = targetSide === "front" ? template.frontSvg : template.backSvg;
    const safeName = template.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    downloadBlob(new Blob([svg], { type: "image/svg+xml" }), `${safeName}-${targetSide}.svg`);
  }

  if (loading) {
    return <p className="py-20 text-center text-sm text-slate-500">Opening template…</p>;
  }

  if (notFound || !template) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="text-xl font-bold text-slate-900">Template not found</h1>
        <Link href="/templates" className="btn-primary mt-5">
          Back to templates
        </Link>
      </div>
    );
  }

  const sideFields = template.fields.filter((f) => f.side === side);
  return (
    <div className="flex h-[calc(100vh-56px)] flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
        <button
          onClick={() => router.push("/templates")}
          className="btn-ghost px-2"
          title="Back to templates"
        >
          <ArrowLeft size={18} />
        </button>
        <input
          className="input h-9 max-w-[220px] flex-1 text-sm font-bold"
          value={template.name}
          onChange={(e) => setTemplate({ ...template, name: e.target.value })}
          aria-label="Template name"
        />
        <span
          className={cx(
            "flex items-center gap-1.5 text-xs font-semibold",
            saved ? "text-emerald-600" : "text-amber-600",
          )}
        >
          {saved ? <Check size={14} /> : <Loader2 size={14} className="animate-spin" />}
          <span className="hidden sm:inline">{saved ? "Saved" : "Saving…"}</span>
        </span>

        <div
          className="ml-auto flex items-center rounded-lg border border-slate-300 bg-white"
          data-history={historyTick}
        >
          <button
            className="px-2 py-1.5 text-slate-600 transition hover:bg-slate-50 disabled:opacity-30"
            onClick={undo}
            disabled={past.current.length === 0}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 size={16} />
          </button>
          <span className="h-5 w-px bg-slate-200" />
          <button
            className="px-2 py-1.5 text-slate-600 transition hover:bg-slate-50 disabled:opacity-30"
            onClick={redo}
            disabled={future.current.length === 0}
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 size={16} />
          </button>
        </div>

        {canSaveBuiltIn ? (
          <button
            className="btn-primary h-9 text-xs"
            onClick={saveAsBuiltIn}
            disabled={savingBuiltIn}
            title="Keep this card in the project, so clearing your browser cannot lose it"
          >
            {savingBuiltIn ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <ShieldCheck size={15} />
            )}
            <span className="hidden sm:inline">
              {savingBuiltIn ? "Keeping…" : "Keep for good"}
            </span>
          </button>
        ) : null}

        <button
          className="btn-secondary h-9 px-2 lg:hidden"
          onClick={() => setShowProperties((open) => !open)}
          aria-label="Toggle properties"
          aria-expanded={showProperties}
          aria-controls="template-properties"
        >
          <SlidersHorizontal size={16} />
        </button>
        <button
          className={cx(canSaveBuiltIn ? "btn-secondary" : "btn-primary", "h-9 text-xs")}
          onClick={saveToApp}
          title="Download this card as a file to put in the project yourself"
        >
          <PackagePlus size={15} />
          <span className="hidden sm:inline">Save to app</span>
        </button>
      </div>

      {/* Workspace */}
      <div className="relative flex min-h-0 flex-1">
        {/* Tool rail */}
        <nav className="flex w-[68px] shrink-0 flex-col gap-1 border-r border-slate-200 bg-white p-2">
          {PANELS.map((tool) => {
            const Icon = tool.icon;
            const active = panel === tool.id;
            return (
              <button
                key={tool.id}
                onClick={() => setPanel(active ? null : tool.id)}
                className={cx(
                  "flex flex-col items-center gap-1 rounded-lg px-1 py-2.5 text-[10px] font-semibold transition",
                  active
                    ? "bg-brand-50 text-brand-700"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-700",
                )}
                title={tool.label}
              >
                <Icon size={19} />
                {tool.label}
              </button>
            );
          })}

          <div className="my-1 h-px bg-slate-200" />

          <button
            onClick={() => {
              addField("text");
              setPanel("details");
            }}
            className="flex flex-col items-center gap-1 rounded-lg px-1 py-2.5 text-[10px] font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            title="Add a text detail"
          >
            <Type size={19} />
            Text
          </button>
          <button
            onClick={() => {
              addField("image");
              setPanel("details");
            }}
            className="flex flex-col items-center gap-1 rounded-lg px-1 py-2.5 text-[10px] font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            title="Add a photo or image box"
          >
            <ImageIcon size={19} />
            Image
          </button>
          <button
            onClick={() => {
              addField("line");
              setPanel("details");
            }}
            className="flex flex-col items-center gap-1 rounded-lg px-1 py-2.5 text-[10px] font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            title="Add a line"
          >
            <Minus size={19} />
            Line
          </button>
          <button
            onClick={() => {
              setShowBulk(true);
              setPanel("details");
            }}
            className="flex flex-col items-center gap-1 rounded-lg px-1 py-2.5 text-[10px] font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            title="Add a whole list of details at once"
          >
            <ListPlus size={19} />
            List
          </button>
        </nav>

        {/* Sliding panel */}
        {panel ? (
          <aside className="flex w-[300px] shrink-0 flex-col border-r border-slate-200 bg-white">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-3 py-2.5">
              <h2 className="text-sm font-bold text-slate-900">
                {panel === "info" ? "Template info" : panel === "artwork" ? "Artwork" : "Details"}
              </h2>
              <button
                className="btn-ghost p-1"
                onClick={() => setPanel(null)}
                title="Hide this panel"
              >
                <PanelLeftClose size={16} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {panel === "info" ? (
      <div className="p-3">
        <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">
          Template info
        </p>
        <div className="space-y-2.5">
          <label className="block">
            <span className="label">Category</span>
            <input
              className="input py-1.5 text-sm"
              value={template.category}
              onChange={(e) => setTemplate({ ...template, category: e.target.value })}
              placeholder="Driving Licence"
            />
          </label>
          <label className="block">
            <span className="label">Description</span>
            <textarea
              className="input py-1.5 text-sm"
              rows={2}
              value={template.description}
              onChange={(e) => setTemplate({ ...template, description: e.target.value })}
            />
          </label>
          <div className="grid grid-cols-3 gap-2">
            <label className="block">
              <span className="label">Width mm</span>
              <input
                type="number"
                step={0.1}
                className="input py-1.5 text-sm"
                value={template.widthMm}
                onChange={(e) =>
                  setTemplate({ ...template, widthMm: Number(e.target.value) || 85.6 })
                }
              />
            </label>
            <label className="block">
              <span className="label">Height mm</span>
              <input
                type="number"
                step={0.1}
                className="input py-1.5 text-sm"
                value={template.heightMm}
                onChange={(e) =>
                  setTemplate({ ...template, heightMm: Number(e.target.value) || 54 })
                }
              />
            </label>
            <label className="block">
              <span className="label">Corner</span>
              <input
                type="number"
                step={0.1}
                className="input py-1.5 text-sm"
                value={template.cornerRadiusMm}
                onChange={(e) =>
                  setTemplate({ ...template, cornerRadiusMm: Number(e.target.value) || 0 })
                }
              />
            </label>
          </div>

          <div className="mt-4 border-t border-slate-100 pt-3">
            {showSaveHelp ? (
              <div className="mt-2 rounded-lg bg-emerald-50 px-3 py-2.5 text-[11px] leading-relaxed text-emerald-900">
                <p className="font-bold">File downloaded. Two steps left:</p>
                <ol className="mt-1 list-decimal space-y-0.5 pl-4">
                  <li>
                    Move it into the{" "}
                    <code className="font-mono font-bold">card-templates</code> folder
                    in your project.
                  </li>
                  <li>
                    Restart the app (<kbd className="font-mono">Ctrl</kbd>+
                    <kbd className="font-mono">C</kbd>, then{" "}
                    <code className="font-mono">npm run dev</code>).
                  </li>
                </ol>
                <p className="mt-1.5">
                  It then shows up for everyone, including on your live site once you
                  push.
                </p>
                <button
                  className="mt-1.5 font-bold underline"
                  onClick={() => setShowSaveHelp(false)}
                >
                  Got it
                </button>
              </div>
            ) : (
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
                {canSaveBuiltIn ? (
                  <>
                    <strong className="text-slate-500">Keep for good</strong> (top right)
                    writes this card into your project, so clearing your browser cannot
                    lose it. Commit and push, and it appears on your live site too.
                  </>
                ) : (
                  <>
                    <strong className="text-slate-500">Save to app</strong> (top right)
                    makes this card a permanent part of the app, so it appears on every
                    computer and on your live site.
                  </>
                )}
              </p>
            )}
          </div>
        </div>
      </div>
              ) : panel === "artwork" ? (
      <div className="p-3">
        <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">
          Artwork (SVG)
        </p>
        {(["front", "back"] as Side[]).map((artSide) => (
          <div key={artSide} className="mb-2.5 last:mb-0">
            <div className="flex items-center gap-2">
              <span className="w-12 text-xs font-semibold capitalize text-slate-600">
                {artSide}
              </span>
              <label className="btn-secondary cursor-pointer px-2.5 py-1.5 text-xs">
                <Upload size={14} />
                Upload
                <input
                  type="file"
                  accept=".svg,image/svg+xml"
                  className="hidden"
                  onChange={(e) => uploadSvg(artSide, e.target.files?.[0])}
                />
              </label>
              <button
                className="btn-ghost px-2 py-1.5 text-xs"
                onClick={() => downloadSvg(artSide)}
                title="Download current artwork"
              >
                <Download size={14} />
              </button>
            </div>
          </div>
        ))}
        <div className="mt-3 border-t border-slate-100 pt-3">
          <button
            className="btn-secondary w-full text-xs"
            onClick={importArtworkText}
            disabled={artworkTextCount === 0}
          >
            <WandSparkles size={14} />
            Import text from artwork
          </button>
          <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
            {artworkTextCount > 0
              ? `Found ${artworkTextCount} text item${artworkTextCount === 1 ? "" : "s"} in the ${side} artwork. Turn them into details you can type into and drag.`
              : `No editable text in the ${side} artwork. If you designed it in Figma, re-export with "Outline text" switched off so the words stay as text.`}
          </p>
        </div>

        <button
          className="btn-ghost mt-2 w-full text-xs"
          onClick={() => setShowSvgCode((v) => !v)}
        >
          {showSvgCode ? "Hide" : "Paste"} SVG code for the {side}
        </button>            {showSvgCode ? (
          <textarea
            className="input mt-2 min-h-[130px] font-mono text-[11px]"
            spellCheck={false}
            value={side === "front" ? template.frontSvg : template.backSvg}
            onChange={(e) =>
              setTemplate((prev) =>
                prev
                  ? ({
                      ...prev,
                      [side === "front" ? "frontSvg" : "backSvg"]: e.target.value,
                    } as CardTemplate)
                  : prev,
              )
            }
          />
        ) : null}
        <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
          Artwork should use a viewBox of {template.widthMm * 10} × {template.heightMm * 10}
          (10 units per mm) so it lines up exactly.
        </p>
      </div>
              ) : (
      <div>
        <div className="border-b border-slate-200 px-3 py-2.5">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">
            Details on the {side}
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            <button
              className="btn-secondary flex-col gap-1 px-1 py-2 text-[10px]"
              onClick={() => addField("text")}
              title="Add a text detail"
            >
              <Type size={15} />
              Text
            </button>
            <button
              className="btn-secondary flex-col gap-1 px-1 py-2 text-[10px]"
              onClick={() => addField("image")}
              title="Add a photo or image box"
            >
              <ImageIcon size={15} />
              Image
            </button>
            <button
              className="btn-secondary flex-col gap-1 px-1 py-2 text-[10px]"
              onClick={() => addField("line")}
              title="Add a line"
            >
              <Minus size={15} />
              Line
            </button>
            <button
              className="btn-secondary flex-col gap-1 px-1 py-2 text-[10px]"
              onClick={() => setShowBulk((v) => !v)}
              title="Add a whole list of details at once"
            >
              <ListPlus size={15} />
              List
            </button>
          </div>
        </div>

        {showBulk ? (
          <div className="border-b border-slate-200 bg-slate-50 p-3">
            <p className="mb-1.5 text-[11px] font-semibold text-slate-600">
              One detail per line — they land in a column for you to drag into place.
            </p>
            <textarea
              className="input min-h-[110px] py-1.5 text-xs"
              placeholder={"Registration No.\nOwner Name\nAddress\nChassis No.\nEngine No."}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
            />
            <div className="mt-2 flex gap-2">
              <button
                className="btn-primary flex-1 px-2 py-1.5 text-xs"
                onClick={() => addFieldsFromList(bulkText)}
                disabled={!bulkText.trim()}
              >
                <ListPlus size={13} />
                Add them
              </button>
              <button
                className="btn-ghost px-2 py-1.5 text-xs"
                onClick={() => {
                  setShowBulk(false);
                  setBulkText("");
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
        <div className="max-h-72 overflow-y-auto p-2">
          {sideFields.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-slate-400">
              No details on this side yet. Use the buttons above to add some.
            </p>
          ) : (
            <ul className="space-y-1">
              {sideFields.map((field) => (
                <li key={field.id}>
                  <div
                    className={cx(
                      "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs transition",
                      selectedId === field.id
                        ? "border-brand-400 bg-brand-50/50"
                        : "border-transparent hover:bg-slate-50",
                    )}
                  >
                    <button
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      onClick={() => setSelectedId(field.id)}
                    >
                      {field.type === "image" ? (
                        field.defaultValue ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={field.defaultValue}
                            alt=""
                            className="checker h-5 w-5 shrink-0 rounded border border-slate-200 object-contain"
                          />
                        ) : (
                          <ImageIcon size={13} className="shrink-0 text-slate-400" />
                        )
                      ) : field.type === "line" ? (
                        <Minus size={13} className="shrink-0 text-slate-400" />
                      ) : (
                        <Type size={13} className="shrink-0 text-slate-400" />
                      )}
                      <span className="truncate font-semibold text-slate-700">
                        {field.label}
                      </span>
                    </button>
                    {field.type === "image" ? (
                      <label
                        className="shrink-0 cursor-pointer text-slate-400 hover:text-brand-600"
                        title={
                          field.defaultValue
                            ? "Replace the template image"
                            : "Upload an image from your computer"
                        }
                      >
                        <ImagePlus size={13} />
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            uploadDefaultImage(field.id, e.target.files?.[0]);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    ) : null}
                    <button
                      className="shrink-0 text-slate-400 hover:text-slate-700"
                      title={field.locked ? "Unlock" : "Lock position"}
                      onClick={() => patchField(field.id, { locked: !field.locked })}
                    >
                      {field.locked ? <Lock size={13} /> : <LockOpen size={13} />}
                    </button>
                    <button
                      className="shrink-0 text-slate-400 hover:text-slate-700"
                      title="Duplicate"
                      onClick={() => duplicateField(field.id)}
                    >
                      <Copy size={13} />
                    </button>
                    <button
                      className="shrink-0 text-slate-400 hover:text-red-600"
                      title="Remove"
                      onClick={() => removeField(field.id)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
              )}
            </div>
          </aside>
        ) : null}

        {/* Canvas */}
        <main className="flex min-w-0 flex-1 flex-col bg-slate-200/60">
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
            {!panel ? (
              <button
                className="btn-ghost p-1.5"
                onClick={() => setPanel("details")}
                title="Show the panel"
              >
                <PanelLeftOpen size={16} />
              </button>
            ) : null}

            <div className="flex rounded-lg border border-slate-300 bg-white p-0.5">
              {(["front", "back"] as Side[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setSide(tab)}
                  className={cx(
                    "rounded-md px-4 py-1.5 text-xs font-semibold capitalize transition",
                    side === tab
                      ? "bg-brand-600 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100",
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>

            <p className="hidden text-xs text-slate-500 lg:block">
              Drag to move · arrow keys nudge · Shift snaps · Delete removes
            </p>

            <div className="ml-auto flex items-center gap-1.5">
              <button
                className="btn-ghost p-1.5"
                onClick={() => setZoom((z) => Math.max(3, z - 1))}
                aria-label="Zoom out"
              >
                <ZoomOut size={16} />
              </button>
              <input
                type="range"
                min={3}
                max={16}
                step={0.5}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-20 accent-brand-600 sm:w-28"
                aria-label="Zoom"
              />
              <button
                className="btn-ghost p-1.5"
                onClick={() => setZoom((z) => Math.min(16, z + 1))}
                aria-label="Zoom in"
              >
                <ZoomIn size={16} />
              </button>
              <button
                className="btn-ghost px-2 py-1 text-[11px] font-semibold"
                onClick={fitToView}
                title="Fit the card to the space"
              >
                Fit
              </button>
            </div>
          </div>

          <div
            ref={canvasAreaRef}
            className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-6"
          >
            <CardCanvas
              template={template}
              card={null}
              side={side}
              pxPerMm={zoom}
              editable
              showGuides
              selectedFieldId={selectedId}
              onSelectField={setSelectedId}
              onLayoutChange={patchLayout}
              showPlaceholders
              idPrefix={`design-${template.id}`}
            />
          </div>

          <div className="flex shrink-0 items-center gap-3 border-t border-slate-200 bg-white px-3 py-1.5 text-[11px] text-slate-500">
            <span>
              {template.widthMm} × {template.heightMm} mm
            </span>
            <span className="ml-auto">
              {sideFields.length} details on the {side}
            </span>
          </div>
        </main>

        {/* Properties */}
        <aside
          id="template-properties"
          className={cx(
            "w-[300px] max-w-full shrink-0 flex-col border-l border-slate-200 bg-white lg:static lg:flex lg:shadow-none",
            showProperties ? "absolute inset-y-0 right-0 z-20 flex shadow-xl" : "hidden",
          )}
        >
          <div className="shrink-0 border-b border-slate-200 px-3 py-2.5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">Properties</h2>
              <button
                className="btn-ghost p-1 lg:hidden"
                onClick={() => setShowProperties(false)}
                aria-label="Close properties"
              >
                <PanelLeftClose size={16} />
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              {selectedField ? "Adjust the selected detail." : "Pick a detail on the card."}
            </p>
          </div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
      {selectedField ? (
        <div className="space-y-2.5 rounded-xl border border-slate-200 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
            Detail settings
          </p>
          <label className="block">
            <span className="label">{selectedField.type === "line" ? "Line label" : "Label shown in the form"}</span>
            <input
              className="input py-1.5 text-sm"
              value={selectedField.label}
              onChange={(e) => {
                const label = e.target.value;
                patchField(selectedField.id, { label });
              }}
            />
          </label>
          <label className="block">
            <span className="label">Saved under (key)</span>
            <input
              className="input py-1.5 font-mono text-xs"
              value={selectedField.key}
              onChange={(e) =>
                patchField(selectedField.id, { key: slugKey(e.target.value) })
              }
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="label">Side</span>
              <select
                className="input py-1.5 text-sm"
                value={selectedField.side}
                onChange={(e) => {
                  const nextSide = e.target.value as Side;
                  patchField(selectedField.id, { side: nextSide });
                  setSide(nextSide);
                }}
              >
                <option value="front">Front</option>
                <option value="back">Back</option>
              </select>
            </label>
            <label className="block">
              <span className="label">Type</span>
              <select
                className="input py-1.5 text-sm"
                value={selectedField.type}
                onChange={(e) => {
                  const type = e.target.value as FieldType;
                  patchField(selectedField.id, {
                    type,
                    ...(type === "line" ? {
                      required: false,
                      layout: { ...selectedField.layout, height: 0.4 },
                    } : selectedField.type === "line" ? {
                      layout: { ...selectedField.layout, height: type === "image" ? 25 : 6 },
                    } : {}),
                  });
                }}
              >
                <option value="text">Text</option>
                <option value="image">Image</option>
                <option value="line">Line</option>
              </select>
            </label>
          </div>
          {selectedField.type === "text" ? (
            <>
              <label className="block">
                <span className="label">Example text (placeholder)</span>
                <input
                  className="input py-1.5 text-sm"
                  value={selectedField.placeholder}
                  onChange={(e) =>
                    patchField(selectedField.id, { placeholder: e.target.value })
                  }
                />
              </label>
              <label className="block">
                <span className="label">Always start with</span>
                <input
                  className="input py-1.5 text-sm"
                  value={selectedField.defaultValue}
                  onChange={(e) =>
                    patchField(selectedField.id, { defaultValue: e.target.value })
                  }
                />
              </label>
            </>
          ) : selectedField.type === "image" ? (
            <div>
              <span className="label">Template image</span>
              <div className="flex items-center gap-2">
                {selectedField.defaultValue ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selectedField.defaultValue}
                    alt=""
                    className="checker h-14 w-14 shrink-0 rounded border border-slate-200 object-contain"
                  />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded border border-dashed border-slate-300 text-slate-300">
                    <ImageIcon size={18} />
                  </div>
                )}
                <div className="flex flex-1 flex-col gap-1.5">
                  <label className="btn-secondary cursor-pointer px-2.5 py-1.5 text-xs">
                    <ImagePlus size={14} />
                    {selectedField.defaultValue ? "Replace image" : "Upload from computer"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        uploadDefaultImage(selectedField.id, e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {selectedField.defaultValue ? (
                    <>
                      <button
                        className="btn-secondary px-2 py-1 text-xs"
                        onClick={() =>
                          setCropFor({
                            id: selectedField.id,
                            src: selectedField.defaultValue,
                            aspect:
                              selectedField.layout.height > 0
                                ? selectedField.layout.width / selectedField.layout.height
                                : undefined,
                          })
                        }
                      >
                        <CropIcon size={13} />
                        Trim the picture
                      </button>
                      <button
                        className="btn-ghost px-2 py-1 text-xs text-red-600"
                        onClick={() => patchField(selectedField.id, { defaultValue: "" })}
                      >
                        <Trash2 size={13} />
                        Remove image
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
                {selectedField.defaultValue
                  ? "This picture appears on every card made from this template. Anyone filling in a card can still replace it with their own."
                  : "Upload a logo, emblem or hologram to show on every card. Leave it empty if each card needs its own photo."}
              </p>
            </div>
          ) : null}
          <label className="block">
            <span className="label">Help note</span>
            <input
              className="input py-1.5 text-sm"
              value={selectedField.helpText}
              onChange={(e) => patchField(selectedField.id, { helpText: e.target.value })}
            />
          </label>
          <div className="flex flex-wrap gap-4 pt-1">
            {selectedField.type !== "line" ? <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <input
                type="checkbox"
                className="h-4 w-4 accent-brand-600"
                checked={selectedField.required}
                onChange={(e) =>
                  patchField(selectedField.id, { required: e.target.checked })
                }
              />
              Required
            </label> : null}
            {selectedField.type === "text" ? (
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-brand-600"
                  checked={selectedField.multiline}
                  onChange={(e) =>
                    patchField(selectedField.id, { multiline: e.target.checked })
                  }
                />
                Multiple lines
              </label>
            ) : null}
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <input
                type="checkbox"
                className="h-4 w-4 accent-brand-600"
                checked={selectedField.locked}
                onChange={(e) => patchField(selectedField.id, { locked: e.target.checked })}
              />
              Lock position
            </label>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 p-4 text-center">
          <button className="btn-primary mx-auto" onClick={() => addField("text")}>
            <Plus size={16} />
            Add a detail
          </button>
          <p className="mt-2.5 text-[11px] leading-relaxed text-slate-500">
            Add the pieces of information this card needs, then drag each one into place on
            the artwork.
          </p>
        </div>
      )}

      <StylePanel
        field={selectedField ? { ...selectedField, hidden: false } : null}
        onLayoutChange={(patch) => selectedField && patchLayout(selectedField.id, patch)}
        onStyleChange={(patch) => selectedField && patchStyle(selectedField.id, patch)}
      />
          </div>
        </aside>
      </div>

      {toast ? (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      ) : null}

      <ImageCropper
        open={cropFor !== null}
        src={cropFor?.src ?? ""}
        aspect={cropFor?.aspect}
        onCancel={() => setCropFor(null)}
        onApply={(dataUrl) => {
          if (cropFor) patchField(cropFor.id, { defaultValue: dataUrl });
          setCropFor(null);
          setToast("Picture trimmed.");
        }}
      />
    </div>
  );
}
