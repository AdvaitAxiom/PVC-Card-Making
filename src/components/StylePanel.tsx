"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDownToLine,
  ArrowUpToLine,
  Italic,
  Minus,
  MoveVertical,
  RotateCcw,
} from "lucide-react";
import {
  FONT_OPTIONS,
  FONT_WEIGHTS,
  FieldLayout,
  FieldStyle,
  ResolvedField,
} from "@/lib/types";
import { supportedWeights, watchFontLoading } from "@/lib/fonts";
import ColourField from "./ColourField";
import { cx, round } from "@/lib/utils";

function NumberInput({
  label,
  value,
  step = 0.5,
  min,
  max,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
        {suffix ? <span className="ml-1 font-normal normal-case text-slate-400">{suffix}</span> : null}
      </span>
      <input
        type="number"
        className="input px-2 py-1.5 text-sm"
        value={Number.isFinite(value) ? round(value, 2) : 0}
        step={step}
        min={min}
        max={max}
        onChange={(e) => {
          const next = parseFloat(e.target.value);
          onChange(Number.isFinite(next) ? next : 0);
        }}
      />
    </label>
  );
}

function ToggleGroup<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: React.ReactNode; title?: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex rounded-lg border border-slate-300 bg-white p-0.5">
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          title={option.title}
          onClick={() => onChange(option.value)}
          className={cx(
            "flex flex-1 items-center justify-center rounded-md px-2 py-1.5 text-xs font-semibold transition",
            value === option.value
              ? "bg-brand-600 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export default function StylePanel({
  field,
  onLayoutChange,
  onStyleChange,
  onReset,
  resetLabel = "Reset to template default",
  canReset = false,
  extra,
}: {
  field: ResolvedField | null;
  onLayoutChange: (patch: Partial<FieldLayout>) => void;
  onStyleChange: (patch: Partial<FieldStyle>) => void;
  onReset?: () => void;
  resetLabel?: string;
  canReset?: boolean;
  extra?: React.ReactNode;
}) {
  // Re-measure once the webfonts arrive, since widths change at that moment.
  const [fontEpoch, setFontEpoch] = useState(0);
  useEffect(() => {
    watchFontLoading(() => setFontEpoch((n) => n + 1));
  }, []);

  const family = field?.style.fontFamily ?? "";
  const usable = useMemo(
    () => supportedWeights(family, FONT_WEIGHTS.map((w) => w.value)),
    // fontEpoch forces a fresh measurement after the fonts load
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [family, fontEpoch],
  );

  if (!field) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 p-4 text-center">
        <p className="text-sm font-semibold text-slate-700">Nothing selected</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          Click any detail on the card preview to move it, resize it or change how it looks.
        </p>
      </div>
    );
  }

  const isText = field.type === "text";
  const isLine = field.type === "line";
  const style = field.style;

  return (
    <div className="divide-y divide-slate-200 rounded-xl border border-slate-200">
      <div className="flex items-start justify-between gap-2 p-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-900">{field.label}</p>
          <p className="text-xs capitalize text-slate-500">
            {field.type} · {field.side}
          </p>
        </div>
        {canReset && onReset ? (
          <button onClick={onReset} className="btn-ghost shrink-0 px-2 py-1 text-xs" title={resetLabel}>
            <RotateCcw size={13} />
            Reset
          </button>
        ) : null}
      </div>

      <div className="space-y-3 p-4">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
          Position &amp; size (mm)
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          <NumberInput label="X" value={field.layout.x} onChange={(x) => onLayoutChange({ x })} />
          <NumberInput label="Y" value={field.layout.y} onChange={(y) => onLayoutChange({ y })} />
          <NumberInput
            label={isLine ? "Length" : "Width"}
            value={field.layout.width}
            min={isLine ? 0.1 : 1}
            onChange={(width) => onLayoutChange({ width: isLine ? Math.max(0.1, width) : width })}
          />
          <NumberInput
            label={isLine ? "Line width" : "Height"}
            value={field.layout.height}
            min={isLine ? 0.1 : 1}
            step={isLine ? 0.1 : 0.5}
            onChange={(height) => onLayoutChange({ height: isLine ? Math.max(0.1, height) : height })}
          />
          <NumberInput
            label={isLine ? "Angle" : "Rotation"}
            suffix="°"
            step={1}
            value={field.layout.rotation}
            onChange={(rotation) => onLayoutChange({ rotation })}
          />
          <NumberInput
            label="Opacity"
            step={0.05}
            min={0}
            max={1}
            value={style.opacity}
            onChange={(opacity) => onStyleChange({ opacity: Math.min(Math.max(opacity, 0), 1) })}
          />
        </div>
      </div>

      {isText ? (
        <div className="space-y-3 p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Text style</p>

          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Font
            </span>
            <select
              className="input px-2 py-1.5 text-sm"
              value={style.fontFamily}
              onChange={(e) => onStyleChange({ fontFamily: e.target.value })}
            >
              {FONT_OPTIONS.map((font) => (
                <option key={font.value} value={font.value} style={{ fontFamily: font.value }}>
                  {font.label}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-2.5">
            <NumberInput
              label="Size"
              suffix="pt"
              step={0.5}
              min={2}
              value={style.fontSize}
              onChange={(fontSize) => onStyleChange({ fontSize: Math.max(fontSize, 1) })}
            />
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Weight
              </span>
              <select
                className="input px-2 py-1.5 text-sm"
                value={style.fontWeight}
                onChange={(e) => onStyleChange({ fontWeight: Number(e.target.value) })}
              >
                {FONT_WEIGHTS.map((weight) => {
                  const real = usable.includes(weight.value);
                  return (
                    <option key={weight.value} value={weight.value}>
                      {weight.label}
                      {real ? "" : " — same as above"}
                    </option>
                  );
                })}
              </select>
            </label>
          </div>

          {usable.length < FONT_WEIGHTS.length ? (
            <p className="rounded-md bg-amber-50 px-2 py-1.5 text-[10px] leading-relaxed text-amber-800">
              This font only has {usable.length} real weight
              {usable.length === 1 ? "" : "s"}. For all seven, pick one of the{" "}
              <strong>Card&nbsp;Sans / Serif / Mono</strong> fonts at the top of the list.
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Align
              </span>
              <ToggleGroup
                value={style.align}
                onChange={(align) => onStyleChange({ align })}
                options={[
                  { value: "left", label: <AlignLeft size={14} />, title: "Left" },
                  { value: "center", label: <AlignCenter size={14} />, title: "Centre" },
                  { value: "right", label: <AlignRight size={14} />, title: "Right" },
                ]}
              />
            </div>
            <div>
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Vertical
              </span>
              <ToggleGroup
                value={style.verticalAlign}
                onChange={(verticalAlign) => onStyleChange({ verticalAlign })}
                options={[
                  { value: "top", label: <ArrowUpToLine size={14} />, title: "Top" },
                  { value: "middle", label: <MoveVertical size={14} />, title: "Middle" },
                  { value: "bottom", label: <ArrowDownToLine size={14} />, title: "Bottom" },
                ]}
              />
            </div>
          </div>

          <div>
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Slant
            </span>
            <ToggleGroup
              value={style.fontStyle}
              onChange={(fontStyle) => onStyleChange({ fontStyle })}
              options={[
                { value: "normal", label: <Minus size={14} />, title: "Normal" },
                { value: "italic", label: <Italic size={14} />, title: "Italic" },
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <NumberInput
              label="Letter space"
              suffix="pt"
              step={0.1}
              value={style.letterSpacing}
              onChange={(letterSpacing) => onStyleChange({ letterSpacing })}
            />
            <NumberInput
              label="Line height"
              step={0.05}
              min={0.7}
              value={style.lineHeight}
              onChange={(lineHeight) => onStyleChange({ lineHeight })}
            />
          </div>

          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Letter case
            </span>
            <select
              className="input px-2 py-1.5 text-sm"
              value={style.textTransform}
              onChange={(e) =>
                onStyleChange({ textTransform: e.target.value as FieldStyle["textTransform"] })
              }
            >
              <option value="none">As typed</option>
              <option value="uppercase">UPPERCASE</option>
              <option value="lowercase">lowercase</option>
              <option value="capitalize">Capitalise Each Word</option>
            </select>
          </label>

          <ColourField
            label="Text colour"
            value={style.color}
            onChange={(color) => onStyleChange({ color })}
          />
        </div>
      ) : isLine ? (
        <div className="space-y-3 p-4">
          <ColourField
            label="Line colour"
            value={style.color}
            onChange={(color) => onStyleChange({ color })}
          />
          <p className="text-xs leading-relaxed text-slate-500">
            Drag either endpoint on the card to stretch and turn the line. The other end stays in place.
          </p>
        </div>
      ) : (
        <div className="space-y-3 p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Image</p>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              How it fills the box
            </span>
            <select
              className="input px-2 py-1.5 text-sm"
              value={style.imageFit}
              onChange={(e) => onStyleChange({ imageFit: e.target.value as FieldStyle["imageFit"] })}
            >
              <option value="cover">Fill the box (crop edges)</option>
              <option value="contain">Fit inside (show whole image)</option>
              <option value="fill">Stretch to the box</option>
            </select>
          </label>
        </div>
      )}

      {!isLine ? <div className="space-y-3 p-4">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Box</p>
        <div className="grid grid-cols-2 gap-2.5">
          <NumberInput
            label="Corner"
            suffix="mm"
            step={0.2}
            min={0}
            value={style.cornerRadius}
            onChange={(cornerRadius) => onStyleChange({ cornerRadius: Math.max(cornerRadius, 0) })}
          />
          <NumberInput
            label="Border"
            suffix="mm"
            step={0.1}
            min={0}
            value={style.borderWidth}
            onChange={(borderWidth) => onStyleChange({ borderWidth: Math.max(borderWidth, 0) })}
          />
        </div>
        <div className="space-y-2.5">
          <ColourField
            label="Background"
            value={style.backgroundColor}
            onChange={(backgroundColor) => onStyleChange({ backgroundColor })}
            allowNone
          />
          <ColourField
            label="Border colour"
            value={style.borderColor}
            onChange={(borderColor) => onStyleChange({ borderColor })}
            allowNone
          />
        </div>
      </div> : null}

      {extra ? <div className="p-4">{extra}</div> : null}
    </div>
  );
}
