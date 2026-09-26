"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Download,
  EyeOff,
  Image as ImageIcon,
  Layers,
  ListChecks,
  Loader2,
  Lock,
  PanelLeftClose,
  PanelLeftOpen,
  PenLine,
  PlusCircle,
  Printer,
  QrCode,
  Redo2,
  RotateCcw,
  Save,
  Trash2,
  Type as TypeIcon,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import CardCanvas from "@/components/CardCanvas";
import StylePanel from "@/components/StylePanel";
import ElementToolbar, { makeElement } from "@/components/ElementToolbar";
import CardDetailsForm from "@/components/CardDetailsForm";
import LayerList from "@/components/LayerList";
import SignaturePad from "@/components/SignaturePad";
import ImageCropper from "@/components/ImageCropper";
import {
  CardElement,
  CardRecord,
  CardTemplate,
  ElementKind,
  FieldLayout,
  FieldStyle,
  ResolvedField,
  Side,
} from "@/lib/types";
import { getCard, getTemplate, saveCard, saveTemplate } from "@/lib/db";
import { resolveField, resolveFields } from "@/lib/render";
import { exportCardPng } from "@/lib/export";
import { readImageScaled } from "@/lib/image";
import {
  arrowDelta,
  isTypingTarget,
  nudgeStep,
} from "@/lib/shortcuts";
import { cx, downloadBlob, round } from "@/lib/utils";

export default function CardEditorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const cardId = params?.id;

  const [card, setCard] = useState<CardRecord | null>(null);
  const [template, setTemplate] = useState<CardTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [side, setSide] = useState<Side>("front");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(7);
  const [saved, setSaved] = useState(true);
  const [busyExport, setBusyExport] = useState(false);
  const [toast, setToast] = useState("");
  const [signatureFor, setSignatureFor] = useState<string | null>(null);
  const [cropFor, setCropFor] = useState<
    { id: string; src: string; aspect?: number } | null
  >(null);
  const [panel, setPanel] = useState<"details" | "add" | "items" | null>("details");
  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const firstLoad = useRef(true);

  // --- Undo / redo -----------------------------------------------------------
  // A burst of typing is collapsed into one step, so undo feels like a word
  // processor rather than stepping back one character at a time.
  const past = useRef<CardRecord[]>([]);
  const future = useRef<CardRecord[]>([]);
  const lastSnapshot = useRef<CardRecord | null>(null);
  const timeTravelling = useRef(false);
  const snapshotTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [historyTick, setHistoryTick] = useState(0);

  const recordNow = useCallback(() => {
    if (snapshotTimer.current) {
      clearTimeout(snapshotTimer.current);
      snapshotTimer.current = null;
    }
  }, []);

  const undo = useCallback(() => {
    recordNow();
    if (!card || past.current.length === 0) return;
    const previous = past.current.pop()!;
    future.current.push(card);
    lastSnapshot.current = previous;
    timeTravelling.current = true;
    setCard(previous);
    setHistoryTick((t) => t + 1);
  }, [card, recordNow]);

  const redo = useCallback(() => {
    recordNow();
    if (!card || future.current.length === 0) return;
    const next = future.current.pop()!;
    past.current.push(card);
    lastSnapshot.current = next;
    timeTravelling.current = true;
    setCard(next);
    setHistoryTick((t) => t + 1);
  }, [card, recordNow]);

  /** On a narrow window the side panel would squeeze the card, so start closed. */
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 1100) setPanel(null);
  }, []);

  /** Picks the largest zoom that still shows the whole card. */
  const fitToView = useCallback(() => {
    const area = canvasAreaRef.current;
    if (!area || !template) return;
    const pad = 48;
    const byWidth = (area.clientWidth - pad) / template.widthMm;
    const byHeight = (area.clientHeight - pad) / template.heightMm;
    const next = Math.min(byWidth, byHeight);
    setZoom(Math.max(3, Math.min(16, Math.round(next * 2) / 2)));
  }, [template]);

  useEffect(() => {
    if (!cardId) return;
    (async () => {
      const loadedCard = await getCard(cardId);
      if (!loadedCard) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const loadedTemplate = await getTemplate(loadedCard.templateId);
      setCard(loadedCard);
      setTemplate(loadedTemplate ?? null);
      setLoading(false);
    })();
  }, [cardId]);

  useEffect(() => {
    if (!card || loading) return;
    if (firstLoad.current) {
      firstLoad.current = false;
      return;
    }
    setSaved(false);
    const timer = setTimeout(() => {
      saveCard(card).then(() => setSaved(true));
    }, 450);
    return () => clearTimeout(timer);
  }, [card, loading]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

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

  /** Remembers the state before each edit so it can be undone. */
  useEffect(() => {
    if (!card || loading) return;

    if (lastSnapshot.current === null) {
      lastSnapshot.current = card;
      return;
    }
    if (timeTravelling.current) {
      timeTravelling.current = false;
      return;
    }
    if (card === lastSnapshot.current) return;

    if (snapshotTimer.current) clearTimeout(snapshotTimer.current);
    snapshotTimer.current = setTimeout(() => {
      const before = lastSnapshot.current;
      if (before && before !== card) {
        past.current.push(before);
        if (past.current.length > 60) past.current.shift();
        future.current = [];
        lastSnapshot.current = card;
        setHistoryTick((t) => t + 1);
      }
      snapshotTimer.current = null;
    }, 400);

    return () => {
      if (snapshotTimer.current) clearTimeout(snapshotTimer.current);
    };
  }, [card, loading]);

  const fieldsForSide = useMemo(
    () => (template ? resolveFields(template, card, side) : []),
    [template, card, side],
  );

  const selectedField: ResolvedField | null = useMemo(() => {
    if (!template || !selectedId) return null;
    const base = template.fields.find((f) => f.id === selectedId);
    if (!base) return null;
    return resolveField(base, card?.overrides?.[base.id]);
  }, [template, card, selectedId]);

  const selectedElement = useMemo(
    () => (card?.elements ?? []).find((el) => el.id === selectedId) ?? null,
    [card, selectedId],
  );

  /** The style panel works on whichever of the two is selected. */
  const panelTarget: ResolvedField | null = useMemo(() => {
    if (selectedField) return selectedField;
    if (!selectedElement) return null;
    return {
      ...selectedElement,
      type: selectedElement.kind === "text" ? "text" : "image",
      key: selectedElement.id,
      required: false,
      multiline: true,
      placeholder: "",
      defaultValue: "",
      helpText: "",
      hidden: false,
    } as unknown as ResolvedField;
  }, [selectedField, selectedElement]);

  /**
   * Built outside the state updater: React runs updaters twice in development,
   * which would otherwise select an item that was thrown away.
   */
  const addElement = useCallback(
    (kind: ElementKind) => {
      const element = makeElement(kind, side, (card?.elements?.length ?? 0) + 1);
      setCard((prev) =>
        prev ? { ...prev, elements: [...(prev.elements ?? []), element] } : prev,
      );
      setSelectedId(element.id);
      if (kind === "signature") setSignatureFor(element.id);
    },
    [side, card],
  );

  const patchElement = useCallback((id: string, patch: Partial<CardElement>) => {
    setCard((prev) =>
      prev
        ? {
            ...prev,
            elements: (prev.elements ?? []).map((el) =>
              el.id === id ? { ...el, ...patch } : el,
            ),
          }
        : prev,
    );
  }, []);

  const patchElementLayout = useCallback((id: string, patch: Partial<FieldLayout>) => {
    setCard((prev) =>
      prev
        ? {
            ...prev,
            elements: (prev.elements ?? []).map((el) =>
              el.id === id ? { ...el, layout: { ...el.layout, ...patch } } : el,
            ),
          }
        : prev,
    );
  }, []);

  const patchElementStyle = useCallback((id: string, patch: Partial<FieldStyle>) => {
    setCard((prev) =>
      prev
        ? {
            ...prev,
            elements: (prev.elements ?? []).map((el) =>
              el.id === id ? { ...el, style: { ...el.style, ...patch } } : el,
            ),
          }
        : prev,
    );
  }, []);

  const removeElement = useCallback(
    (id: string) => {
      setCard((prev) =>
        prev
          ? { ...prev, elements: (prev.elements ?? []).filter((el) => el.id !== id) }
          : prev,
      );
      setSelectedId((current) => (current === id ? null : current));
    },
    [],
  );

  /** One handler for the canvas, whichever kind of thing was dragged. */
  const handleCanvasLayout = useCallback(
    (id: string, layout: FieldLayout) => {
      const isElement = (card?.elements ?? []).some((el) => el.id === id);
      if (isElement) {
        patchElementLayout(id, layout);
      } else {
        setCard((prev) => {
          if (!prev) return prev;
          const current = prev.overrides[id] ?? {};
          return {
            ...prev,
            overrides: {
              ...prev.overrides,
              [id]: { ...current, layout: { ...current.layout, ...layout } },
            },
          };
        });
      }
    },
    [card, patchElementLayout],
  );

  const setValue = useCallback((key: string, value: string) => {
    setCard((prev) => (prev ? { ...prev, values: { ...prev.values, [key]: value } } : prev));
  }, []);

  const patchOverride = useCallback(
    (
      fieldId: string,
      patch: { layout?: Partial<FieldLayout>; style?: Partial<FieldStyle>; hidden?: boolean },
    ) => {
      setCard((prev) => {
        if (!prev) return prev;
        const current = prev.overrides[fieldId] ?? {};
        return {
          ...prev,
          overrides: {
            ...prev.overrides,
            [fieldId]: {
              ...current,
              layout: patch.layout ? { ...current.layout, ...patch.layout } : current.layout,
              style: patch.style ? { ...current.style, ...patch.style } : current.style,
              hidden: patch.hidden ?? current.hidden,
            },
          },
        };
      });
    },
    [],
  );

  const resetField = useCallback((fieldId: string) => {
    setCard((prev) => {
      if (!prev) return prev;
      const next = { ...prev.overrides };
      delete next[fieldId];
      return { ...prev, overrides: next };
    });
  }, []);

  async function saveLayoutToTemplate() {
    if (!template || !card || !selectedField) return;
    const nextFields = template.fields.map((f) =>
      f.id === selectedField.id
        ? { ...f, layout: selectedField.layout, style: selectedField.style }
        : f,
    );
    const updated = await saveTemplate({ ...template, fields: nextFields });
    setTemplate(updated);
    resetField(selectedField.id);
    setToast("Saved as the template's default position and style.");
  }

  async function handleImage(key: string, file: File | undefined) {
    if (!file) return;
    try {
      const dataUrl = await readImageScaled(file);
      setValue(key, dataUrl);
    } catch {
      setToast("Sorry, that image could not be read.");
    }
  }

  /**
   * Removes whatever is selected. Items the user added are deleted outright;
   * a detail that belongs to the template is hidden instead, since deleting it
   * would mean changing the template for every other card.
   */
  const deleteSelected = useCallback(() => {
    if (!selectedId || !card) return;

    const element = (card.elements ?? []).find((el) => el.id === selectedId);
    if (element) {
      removeElement(selectedId);
      setToast(`Removed "${element.label}". Press Ctrl+Z to bring it back.`);
      return;
    }

    const field = template?.fields.find((f) => f.id === selectedId);
    if (!field) return;
    if (field.locked) {
      setToast(`"${field.label}" is locked in the template.`);
      return;
    }
    if (card.overrides[field.id]?.hidden) return;

    patchOverride(field.id, { hidden: true });
    setToast(`Hid "${field.label}" on this card. Press Ctrl+Z to undo.`);
  }, [selectedId, card, template, removeElement, patchOverride]);

  async function handleExportPng(exportSide: Side) {
    if (!template || !card) return;
    setBusyExport(true);
    try {
      const blob = await exportCardPng(template, card, exportSide, 300);
      const safeTitle = card.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "card";
      downloadBlob(blob, `${safeTitle}-${exportSide}-300dpi.png`);
    } catch {
      setToast("The image export failed. Try the Print option instead.");
    } finally {
      setBusyExport(false);
    }
  }

  /** Moves whatever is selected, so arrow keys work wherever focus happens to be. */
  const nudgeSelected = useCallback(
    (dx: number, dy: number) => {
      if (!selectedId || !card) return;

      const element = (card.elements ?? []).find((el) => el.id === selectedId);
      if (element) {
        if (element.locked) return;
        patchElementLayout(element.id, {
          x: round(element.layout.x + dx, 2),
          y: round(element.layout.y + dy, 2),
        });
        return;
      }

      const base = template?.fields.find((f) => f.id === selectedId);
      if (!base || base.locked) return;
      const current = resolveField(base, card.overrides[base.id]);
      patchOverride(base.id, {
        layout: {
          x: round(current.layout.x + dx, 2),
          y: round(current.layout.y + dy, 2),
        },
      });
    },
    [selectedId, card, template, patchElementLayout, patchOverride],
  );

  /** Keyboard shortcuts: Delete removes the selection, Ctrl+Z steps back. */
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (signatureFor !== null) return;

      const typing = isTypingTarget(event.target);
      const combo = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      if (combo && key === "z") {
        // Inside a text box, leave the browser's own undo alone.
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
        event.preventDefault();
        deleteSelected();
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
  }, [selectedId, signatureFor, undo, redo, deleteSelected, nudgeSelected]);

  if (loading) {
    return <p className="py-20 text-center text-sm text-slate-500">Opening your card…</p>;
  }

  if (notFound || !card) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="text-xl font-bold text-slate-900">Card not found</h1>
        <p className="mt-2 text-sm text-slate-500">It may have been deleted from this browser.</p>
        <Link href="/dashboard" className="btn-primary mt-5">
          Back to my cards
        </Link>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="text-xl font-bold text-slate-900">Template missing</h1>
        <p className="mt-2 text-sm text-slate-500">
          The template this card was built from no longer exists. Restore it from a backup or
          rebuild the card from another template.
        </p>
        <Link href="/dashboard" className="btn-primary mt-5">
          Back to my cards
        </Link>
      </div>
    );
  }

  const hasOverride = selectedField ? Boolean(card.overrides[selectedField.id]) : false;

  const hiddenIds = new Set(
    Object.entries(card.overrides)
      .filter(([, o]) => o?.hidden)
      .map(([id]) => id),
  );

  const TOOLS = [
    { id: "details" as const, icon: ListChecks, label: "Details" },
    { id: "add" as const, icon: PlusCircle, label: "Add" },
    { id: "items" as const, icon: Layers, label: "Items" },
  ];

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
        <button onClick={() => router.push("/dashboard")} className="btn-ghost px-2" title="Back">
          <ArrowLeft size={18} />
        </button>
        <input
          className="input h-9 max-w-[220px] flex-1 text-sm font-bold"
          value={card.title}
          onChange={(e) => setCard({ ...card, title: e.target.value })}
          placeholder="Name this card"
          aria-label="Card name"
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

        <div className="ml-auto flex items-center gap-2">
          <div
            className="flex items-center rounded-lg border border-slate-300 bg-white"
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

          <button
            className="btn-secondary h-9 text-xs"
            disabled={busyExport}
            onClick={() => handleExportPng(side)}
          >
            {busyExport ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            <span className="hidden sm:inline">PNG</span>
          </button>
          <Link href={`/print/${card.id}`} className="btn-primary h-9">
            <Printer size={15} />
            <span className="hidden sm:inline">Preview &amp; print</span>
          </Link>
        </div>
      </div>

      {/* Workspace */}
      <div className="flex min-h-0 flex-1">
        {/* Tool rail */}
        <nav className="flex w-[68px] shrink-0 flex-col gap-1 border-r border-slate-200 bg-white p-2">
          {TOOLS.map((tool) => {
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

          {(
            [
              { kind: "text" as const, icon: TypeIcon, label: "Text" },
              { kind: "image" as const, icon: ImageIcon, label: "Image" },
              { kind: "qr" as const, icon: QrCode, label: "QR" },
              { kind: "signature" as const, icon: PenLine, label: "Sign" },
            ]
          ).map((tool) => {
            const Icon = tool.icon;
            return (
              <button
                key={tool.kind}
                onClick={() => {
                  addElement(tool.kind);
                  setPanel("add");
                }}
                className="flex flex-col items-center gap-1 rounded-lg px-1 py-2.5 text-[10px] font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                title={`Add ${tool.label.toLowerCase()}`}
              >
                <Icon size={19} />
                {tool.label}
              </button>
            );
          })}
        </nav>

        {/* Sliding panel */}
        {panel ? (
          <aside className="flex w-[290px] shrink-0 flex-col border-r border-slate-200 bg-white">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-3 py-2.5">
              <h2 className="text-sm font-bold text-slate-900">
                {panel === "details" ? "Card details" : panel === "add" ? "Add your own" : "Items"}
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
              {panel === "details" ? (
                <CardDetailsForm
                  template={template}
                  card={card}
                  selectedId={selectedId}
                  onSelect={(id, fieldSide) => {
                    setSelectedId(id);
                    setSide(fieldSide);
                  }}
                  onSetValue={setValue}
                  onToggleHidden={(id, hidden) => patchOverride(id, { hidden })}
                  onPickImage={handleImage}
                  onCrop={(key, src, field) =>
                    setCropFor({
                      id: `value:${key}`,
                      src,
                      aspect:
                        field.layout.height > 0
                          ? field.layout.width / field.layout.height
                          : undefined,
                    })
                  }
                />
              ) : panel === "add" ? (
                <ElementToolbar
                  elements={card.elements ?? []}
                  side={side}
                  selectedId={selectedId}
                  onSelect={(id) => setSelectedId(id)}
                  onAdd={addElement}
                  onChange={patchElement}
                  onRemove={removeElement}
                  onOpenSignature={(id) => setSignatureFor(id)}
                  onCrop={(element) =>
                    setCropFor({
                      id: element.id,
                      src: element.value,
                      aspect:
                        element.layout.height > 0
                          ? element.layout.width / element.layout.height
                          : undefined,
                    })
                  }
                />
              ) : (
                <LayerList
                  fields={fieldsForSide}
                  elements={card.elements ?? []}
                  side={side}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onRemoveElement={removeElement}
                  onToggleHidden={(id, hidden) => patchOverride(id, { hidden })}
                  hiddenIds={hiddenIds}
                />
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
              Drag to move · arrow keys nudge · <kbd className="font-sans font-semibold">Del</kbd>{" "}
              removes · <kbd className="font-sans font-semibold">Ctrl+Z</kbd> undoes
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
              card={card}
              side={side}
              pxPerMm={zoom}
              editable
              selectedFieldId={selectedId}
              onSelectField={setSelectedId}
              onLayoutChange={handleCanvasLayout}
              showPlaceholders
              idPrefix={`edit-${card.id}`}
            />
          </div>

          <div className="flex shrink-0 items-center gap-3 border-t border-slate-200 bg-white px-3 py-1.5 text-[11px] text-slate-500">
            <span>
              {template.widthMm} × {template.heightMm} mm
            </span>
            <span className="ml-auto">
              {fieldsForSide.length + (card.elements ?? []).filter((e) => e.side === side).length}{" "}
              items on the {side}
            </span>
          </div>
        </main>

        {/* Properties */}
        <aside className="hidden w-[300px] shrink-0 flex-col border-l border-slate-200 bg-white lg:flex">
          <div className="shrink-0 border-b border-slate-200 px-3 py-2.5">
            <h2 className="text-sm font-bold text-slate-900">Properties</h2>
            <p className="text-[11px] text-slate-500">
              {panelTarget ? "Adjust the selected item." : "Pick something on the card."}
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <StylePanel
              field={panelTarget}
              canReset={hasOverride}
              onReset={() => selectedField && resetField(selectedField.id)}
              onLayoutChange={(patch) => {
                if (selectedElement) patchElementLayout(selectedElement.id, patch);
                else if (selectedField) patchOverride(selectedField.id, { layout: patch });
              }}
              onStyleChange={(patch) => {
                if (selectedElement) patchElementStyle(selectedElement.id, patch);
                else if (selectedField) patchOverride(selectedField.id, { style: patch });
              }}
              extra={
                selectedField ? (
                  <div className="space-y-2">
                    <button
                      className="btn-secondary w-full text-xs"
                      onClick={saveLayoutToTemplate}
                    >
                      <Save size={14} />
                      Save as template default
                    </button>
                    {hasOverride ? (
                      <button
                        className="btn-ghost w-full text-xs"
                        onClick={() => resetField(selectedField.id)}
                      >
                        <RotateCcw size={14} />
                        Undo my changes
                      </button>
                    ) : null}
                    {selectedField.locked ? (
                      <p className="flex items-center gap-1.5 text-[11px] text-amber-600">
                        <Lock size={12} /> Locked in the template.
                      </p>
                    ) : (
                      <button
                        className="btn-danger w-full text-xs"
                        onClick={deleteSelected}
                        disabled={Boolean(card.overrides[selectedField.id]?.hidden)}
                      >
                        <EyeOff size={14} />
                        Hide from this card
                        <kbd className="ml-1 rounded bg-red-100 px-1 text-[10px] font-bold">
                          Del
                        </kbd>
                      </button>
                    )}
                  </div>
                ) : selectedElement ? (
                  <button
                    className="btn-danger w-full text-xs"
                    onClick={() => removeElement(selectedElement.id)}
                  >
                    <Trash2 size={14} />
                    Remove this item
                    <kbd className="ml-1 rounded bg-red-100 px-1 text-[10px] font-bold">Del</kbd>
                  </button>
                ) : null
              }
            />
          </div>
        </aside>
      </div>

      {toast ? (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      ) : null}

      <SignaturePad
        open={signatureFor !== null}
        onClose={() => setSignatureFor(null)}
        onSave={(dataUrl) => {
          if (signatureFor) patchElement(signatureFor, { value: dataUrl });
        }}
      />

      <ImageCropper
        open={cropFor !== null}
        src={cropFor?.src ?? ""}
        aspect={cropFor?.aspect}
        onCancel={() => setCropFor(null)}
        onApply={(dataUrl) => {
          if (cropFor) {
            // "value:" marks a template field, which stores its picture as a value.
            if (cropFor.id.startsWith("value:")) setValue(cropFor.id.slice(6), dataUrl);
            else patchElement(cropFor.id, { value: dataUrl });
          }
          setCropFor(null);
          setToast("Picture trimmed.");
        }}
      />
    </div>
  );
}
