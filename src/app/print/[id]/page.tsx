"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Download,
  FileImage,
  Layers,
  Loader2,
  Printer,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import CardCanvas from "@/components/CardCanvas";
import SheetPreview from "@/components/SheetPreview";
import SheetControls from "@/components/SheetControls";
import {
  CardRecord,
  CardTemplate,
  DEFAULT_SHEET,
  SheetLayout,
  Side,
  A4,
} from "@/lib/types";
import { getCard, getTemplate, listCards } from "@/lib/db";
import { MM_TO_PX } from "@/lib/render";
import { buildSheets, maxGrid } from "@/lib/sheet";
import { buildCardSvgEmbedded, exportCardPng } from "@/lib/export";
import { cx, downloadBlob } from "@/lib/utils";

type ViewMode = "sheet" | "single";

export default function PrintPage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const cardId = params?.id;

  const [card, setCard] = useState<CardRecord | null>(null);
  const [template, setTemplate] = useState<CardTemplate | null>(null);
  const [siblings, setSiblings] = useState<CardRecord[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<ViewMode>("sheet");
  const [layout, setLayout] = useState<SheetLayout>({ ...DEFAULT_SHEET });
  const [scale, setScale] = useState(0.62);
  const [busy, setBusy] = useState(false);
  const [printError, setPrintError] = useState("");

  useEffect(() => {
    if (!cardId) return;
    (async () => {
      const loadedCard = await getCard(cardId);
      if (loadedCard) {
        setCard(loadedCard);
        const loadedTemplate = await getTemplate(loadedCard.templateId);
        setTemplate(loadedTemplate ?? null);

        // Start by filling the page, which is what most people want.
        if (loadedTemplate) {
          const fit = maxGrid(loadedTemplate, DEFAULT_SHEET);
          setLayout((prev) => ({ ...prev, columns: fit.columns, rows: fit.rows }));
        }

        // Other cards built from the same template can share a sheet.
        const all = await listCards();
        const sameTemplate = all.filter((c) => c.templateId === loadedCard.templateId);
        setSiblings(sameTemplate);

        const wanted = search.get("ids");
        const requested = wanted ? wanted.split(",").filter(Boolean) : null;
        setSelectedIds(
          requested && requested.length > 0
            ? requested.filter((id) => sameTemplate.some((c) => c.id === id))
            : [loadedCard.id],
        );
      }
      setLoading(false);
    })();
  }, [cardId, search]);

  const cardsById = useMemo(() => {
    const map: Record<string, CardRecord> = {};
    for (const c of siblings) map[c.id] = c;
    if (card) map[card.id] = card;
    return map;
  }, [siblings, card]);

  const sheets = useMemo(() => {
    if (!template) return [];
    return buildSheets(selectedIds, template, layout);
  }, [selectedIds, template, layout]);

  const pageCss = useMemo(() => {
    if (!template) return "";
    if (mode === "single") {
      return `@media print { @page { size: ${template.widthMm}mm ${template.heightMm}mm; margin: 0; } }`;
    }
    return `@media print { @page { size: A4 portrait; margin: 0; } }`;
  }, [mode, template]);

  const missingRequired = useMemo(() => {
    if (!template || !card) return [];
    return template.fields
      .filter((f) => f.required && !card.overrides[f.id]?.hidden)
      .filter((f) => !(card.values[f.key] ?? f.defaultValue ?? "").trim())
      .map((f) => f.label);
  }, [template, card]);

  function handlePrint() {
    try {
      window.print();
    } catch {
      setPrintError(
        "This window would not open the print dialog. Open the app in your normal web browser (Chrome, Edge or Firefox) to print, or download the PNG and print that instead.",
      );
    }
  }

  async function downloadPng(side: Side) {
    if (!template || !card) return;
    setBusy(true);
    try {
      const blob = await exportCardPng(template, card, side, 300);
      const name = card.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "card";
      downloadBlob(blob, `${name}-${side}-300dpi.png`);
    } finally {
      setBusy(false);
    }
  }

  async function downloadSvg(side: Side) {
    if (!template || !card) return;
    const svg = await buildCardSvgEmbedded(template, card, side);
    const name = card.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "card";
    downloadBlob(new Blob([svg], { type: "image/svg+xml" }), `${name}-${side}.svg`);
  }

  function toggleCard(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  if (loading) {
    return <p className="py-20 text-center text-sm text-slate-500">Preparing your card…</p>;
  }

  if (!card || !template) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="text-xl font-bold text-slate-900">Card not available</h1>
        <p className="mt-2 text-sm text-slate-500">
          This card or its template could not be found in this browser.
        </p>
        <Link href="/dashboard" className="btn-primary mt-5">
          Back to my cards
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <style dangerouslySetInnerHTML={{ __html: pageCss }} />

      <header className="no-print sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1500px] flex-wrap items-center gap-3 px-4 py-3">
          <Link href={`/cards/${card.id}`} className="btn-ghost px-2">
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-bold text-slate-900">{card.title}</h1>
            <p className="truncate text-xs text-slate-500">{template.name}</p>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-slate-300 bg-white p-0.5">
              <button
                onClick={() => setMode("sheet")}
                className={cx(
                  "rounded-md px-3 py-1.5 text-xs font-semibold transition",
                  mode === "sheet" ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100",
                )}
              >
                A4 sheet
              </button>
              <button
                onClick={() => setMode("single")}
                className={cx(
                  "rounded-md px-3 py-1.5 text-xs font-semibold transition",
                  mode === "single" ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100",
                )}
              >
                One card
              </button>
            </div>

            <button
              className="btn-secondary text-xs"
              disabled={busy}
              onClick={() => downloadPng("front")}
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              Front PNG
            </button>
            <button className="btn-secondary text-xs" onClick={() => downloadSvg("front")}>
              <FileImage size={14} />
              SVG
            </button>
            <button className="btn-primary" onClick={handlePrint}>
              <Printer size={16} />
              Print
            </button>
          </div>
        </div>

        <div className="mx-auto w-full max-w-[1500px] px-4 pb-3">
          {printError ? (
            <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-[11px] leading-relaxed text-red-800">
              {printError}
            </p>
          ) : null}
          {missingRequired.length > 0 ? (
            <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-[11px] leading-relaxed text-red-800">
              <strong>Still empty:</strong> {missingRequired.join(", ")}. Go back and fill these
              in before printing.
            </p>
          ) : null}
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800">
            In the print dialog set <strong>Margins</strong> to <em>None</em> and{" "}
            <strong>Scale</strong> to <em>100%</em> (turn off &ldquo;Fit to page&rdquo;) so every
            card comes out at exactly {template.widthMm} × {template.heightMm} mm.
          </p>
        </div>
      </header>

      {mode === "single" ? (
        <main className="print-sheet mx-auto w-full max-w-5xl px-4 py-8">
          <div className="flex flex-col items-center gap-8">
            {(["front", "back"] as Side[]).map((side) => (
              <div key={side} className="print-page flex flex-col items-center gap-2">
                <span className="no-print text-xs font-bold uppercase tracking-wide text-slate-400">
                  {side}
                </span>
                <CardCanvas
                  template={template}
                  card={card}
                  side={side}
                  pxPerMm={MM_TO_PX}
                  showPlaceholders={false}
                  hiddenOutlines
                  idPrefix={`one-${side}`}
                />
              </div>
            ))}
          </div>
        </main>
      ) : (
        <div className="mx-auto flex w-full max-w-[1500px] gap-4 px-4 py-6">
          <aside className="no-print w-[300px] shrink-0 space-y-3">
            <SheetControls
              layout={layout}
              onChange={setLayout}
              template={template}
              cardCount={selectedIds.length}
            />

            <div className="card-panel">
              <div className="border-b border-slate-200 px-4 py-3">
                <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <Layers size={15} />
                  Cards on this sheet
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Tick several to print them together and save paper.
                </p>
              </div>
              <div className="max-h-[280px] overflow-y-auto p-2">
                {siblings.length === 0 ? (
                  <p className="px-2 py-4 text-center text-xs text-slate-400">
                    No other cards use this template.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {siblings.map((sibling) => (
                      <li key={sibling.id}>
                        <label
                          className={cx(
                            "flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-xs transition",
                            selectedIds.includes(sibling.id)
                              ? "bg-brand-50/60 font-semibold text-brand-800"
                              : "text-slate-600 hover:bg-slate-50",
                          )}
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-brand-600"
                            checked={selectedIds.includes(sibling.id)}
                            onChange={() => toggleCard(sibling.id)}
                          />
                          <span className="truncate">{sibling.title}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex gap-2 border-t border-slate-200 p-3">
                <button
                  className="btn-secondary flex-1 text-xs"
                  onClick={() => setSelectedIds(siblings.map((s) => s.id))}
                >
                  Select all
                </button>
                <button
                  className="btn-ghost text-xs"
                  onClick={() => setSelectedIds([card.id])}
                >
                  Just this one
                </button>
              </div>
            </div>
          </aside>

          <main className="print-sheet min-w-0 flex-1">
            <div className="no-print mb-3 flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">
                {sheets.length} sheet{sheets.length === 1 ? "" : "s"} · A4 {A4.widthMm}×
                {A4.heightMm} mm
              </span>
              <div className="ml-auto flex items-center gap-1.5">
                <button
                  className="btn-ghost p-1.5"
                  onClick={() => setScale((s) => Math.max(0.25, s - 0.1))}
                  aria-label="Zoom out"
                >
                  <ZoomOut size={16} />
                </button>
                <input
                  type="range"
                  min={0.25}
                  max={1.2}
                  step={0.05}
                  value={scale}
                  onChange={(e) => setScale(Number(e.target.value))}
                  className="w-24 accent-brand-600"
                  aria-label="Zoom"
                />
                <button
                  className="btn-ghost p-1.5"
                  onClick={() => setScale((s) => Math.min(1.2, s + 0.1))}
                  aria-label="Zoom in"
                >
                  <ZoomIn size={16} />
                </button>
              </div>
            </div>

            <div className="flex flex-col items-center gap-6">
              {sheets.map((slots, index) => (
                <SheetPreview
                  key={index}
                  slots={slots}
                  cards={cardsById}
                  template={template}
                  layout={layout}
                  scale={scale}
                  pageNumber={index + 1}
                />
              ))}
            </div>
          </main>
        </div>
      )}
    </div>
  );
}
