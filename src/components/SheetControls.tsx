"use client";

import { Minus, Plus, RotateCcw } from "lucide-react";
import { CardTemplate, DEFAULT_SHEET, SheetLayout } from "@/lib/types";
import { sheetSummary } from "@/lib/sheet";
import { cx } from "@/lib/utils";

function Stepper({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
        {suffix ? <span className="ml-1 font-normal normal-case text-slate-400">{suffix}</span> : null}
      </span>
      <div className="flex items-stretch rounded-lg border border-slate-300 bg-white">
        <button
          type="button"
          className="px-2 text-slate-500 hover:bg-slate-50 disabled:opacity-30"
          onClick={() => onChange(Math.max(min, Math.round((value - step) * 100) / 100))}
          disabled={value <= min}
          aria-label={`Decrease ${label}`}
        >
          <Minus size={13} />
        </button>
        <input
          type="number"
          className="w-full min-w-0 border-x border-slate-200 px-1 py-1.5 text-center text-sm outline-none"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            const next = parseFloat(e.target.value);
            if (Number.isFinite(next)) onChange(Math.min(max, Math.max(min, next)));
          }}
        />
        <button
          type="button"
          className="px-2 text-slate-500 hover:bg-slate-50 disabled:opacity-30"
          onClick={() => onChange(Math.min(max, Math.round((value + step) * 100) / 100))}
          disabled={value >= max}
          aria-label={`Increase ${label}`}
        >
          <Plus size={13} />
        </button>
      </div>
    </div>
  );
}

export default function SheetControls({
  layout,
  onChange,
  template,
  cardCount,
}: {
  layout: SheetLayout;
  onChange: (next: SheetLayout) => void;
  template: CardTemplate;
  cardCount: number;
}) {
  const summary = sheetSummary(cardCount, template, layout);
  const set = (patch: Partial<SheetLayout>) => onChange({ ...layout, ...patch });

  return (
    <div className="card-panel divide-y divide-slate-200">
      <div className="p-4">
        <p className="text-sm font-bold text-slate-900">Sheet layout</p>
        <p className="mt-0.5 text-xs text-slate-500">
          Fit as many cards on the page as you can, to save card stock.
        </p>
      </div>

      <div className="space-y-3 p-4">
        <div>
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Put on the sheet
          </span>
          <div className="flex rounded-lg border border-slate-300 bg-white p-0.5">
            {(
              [
                { value: "both", label: "Front + back" },
                { value: "front", label: "Fronts" },
                { value: "back", label: "Backs" },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                onClick={() => set({ content: option.value })}
                className={cx(
                  "flex-1 rounded-md px-2 py-1.5 text-[11px] font-semibold transition",
                  layout.content === option.value
                    ? "bg-brand-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <Stepper
            label="Across"
            value={layout.columns}
            min={1}
            max={summary.limits.columns}
            onChange={(columns) => set({ columns })}
          />
          <Stepper
            label="Down"
            value={layout.rows}
            min={1}
            max={summary.limits.rows}
            onChange={(rows) => set({ rows })}
          />
          <Stepper
            label="Gap across"
            suffix="mm"
            value={layout.gapX}
            min={0}
            max={40}
            step={0.5}
            onChange={(gapX) => set({ gapX })}
          />
          <Stepper
            label="Gap down"
            suffix="mm"
            value={layout.gapY}
            min={0}
            max={40}
            step={0.5}
            onChange={(gapY) => set({ gapY })}
          />
          <Stepper
            label="Margin top"
            suffix="mm"
            value={layout.marginTop}
            min={0}
            max={60}
            step={0.5}
            onChange={(marginTop) => set({ marginTop })}
          />
          <Stepper
            label="Margin left"
            suffix="mm"
            value={layout.marginLeft}
            min={0}
            max={60}
            step={0.5}
            onChange={(marginLeft) => set({ marginLeft })}
          />
        </div>

        <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
          <input
            type="checkbox"
            className="h-4 w-4 accent-brand-600"
            checked={layout.cutMarks}
            onChange={(e) => set({ cutMarks: e.target.checked })}
          />
          Show cut marks
        </label>

        <div className="flex gap-2">
          <button
            className="btn-secondary flex-1 text-xs"
            onClick={() =>
              set({ columns: summary.limits.columns, rows: summary.limits.rows })
            }
            title="Use every bit of the page"
          >
            Fill the page
          </button>
          <button
            className="btn-ghost px-2 text-xs"
            onClick={() => onChange({ ...DEFAULT_SHEET })}
            title="Back to defaults"
          >
            <RotateCcw size={13} />
          </button>
        </div>
      </div>

      <div className="p-4">
        <p className="text-[11px] leading-relaxed text-slate-500">
          <strong className="text-slate-700">
            {summary.columns} × {summary.rows} = {summary.perSheet}
          </strong>{" "}
          per sheet · {summary.pieces} to print ·{" "}
          <strong className="text-slate-700">
            {summary.sheets} sheet{summary.sheets === 1 ? "" : "s"}
          </strong>
        </p>
        {layout.columns > summary.limits.columns || layout.rows > summary.limits.rows ? (
          <p className="mt-1.5 rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
            Only {summary.limits.columns} × {summary.limits.rows} fit with these margins.
          </p>
        ) : null}
      </div>
    </div>
  );
}
