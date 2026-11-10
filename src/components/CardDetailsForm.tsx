"use client";

import { Crop as CropIcon, Eye, EyeOff, ImagePlus, Trash2 } from "lucide-react";
import { CardRecord, CardTemplate, Side, TemplateField } from "@/lib/types";
import { cx } from "@/lib/utils";

/** The template's own fields, filled in for this card. */
export default function CardDetailsForm({
  template,
  card,
  selectedId,
  onSelect,
  onSetValue,
  onToggleHidden,
  onPickImage,
  onCrop,
}: {
  template: CardTemplate;
  card: CardRecord;
  selectedId: string | null;
  onSelect: (id: string, side: Side) => void;
  onSetValue: (key: string, value: string) => void;
  onToggleHidden: (fieldId: string, hidden: boolean) => void;
  onPickImage: (key: string, file: File | undefined) => void;
  onCrop?: (key: string, src: string, field: TemplateField) => void;
}) {
  if (template.fields.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-xs leading-relaxed text-slate-400">
        This template has no details yet. Add them in{" "}
        <strong className="text-slate-500">Templates</strong>, or use the tools on the left
        to put text and pictures straight onto this card.
      </p>
    );
  }

  return (
    <div className="space-y-4 p-3">
      {(["front", "back"] as Side[]).map((formSide) => {
        const sideFields = template.fields.filter((f) => f.side === formSide);
        if (sideFields.length === 0) return null;
        return (
          <div key={formSide}>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">
              {formSide === "front" ? "Front of card" : "Back of card"}
            </p>
            <div className="space-y-2.5">
              {sideFields.map((field) => {
                const value = card.values[field.key] ?? "";
                const active = selectedId === field.id;
                const hidden = card.overrides[field.id]?.hidden ?? false;
                return (
                  <div
                    key={field.id}
                    className={cx(
                      "rounded-lg border p-2.5 transition",
                      active ? "border-brand-400 bg-brand-50/40" : "border-slate-200",
                    )}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <button
                        className="truncate text-left text-xs font-semibold text-slate-700"
                        onClick={() => onSelect(field.id, field.side)}
                      >
                        {field.label}
                        {field.required ? <span className="text-red-500"> *</span> : null}
                      </button>
                      <button
                        className="shrink-0 text-slate-400 hover:text-slate-700"
                        title={hidden ? "Show on card" : "Hide from card"}
                        onClick={() => onToggleHidden(field.id, !hidden)}
                      >
                        {hidden ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>

                    {field.type === "line" ? (
                      <p className="text-[11px] text-slate-400">
                        Select the line to adjust its width, colour or angle.
                      </p>
                    ) : field.type === "image" ? (
                      <div className="flex items-center gap-2">
                        {value || field.defaultValue ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={value || field.defaultValue}
                            alt={field.label}
                            className="checker h-10 w-10 shrink-0 rounded border border-slate-200 object-contain"
                          />
                        ) : null}
                        <div className="flex min-w-0 flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            <label className="btn-secondary cursor-pointer px-2 py-1 text-[11px]">
                              <ImagePlus size={13} />
                              {value || field.defaultValue ? "Replace" : "Upload"}
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  onPickImage(field.key, e.target.files?.[0]);
                                  e.target.value = "";
                                }}
                              />
                            </label>
                            {value && onCrop ? (
                              <button
                                className="btn-ghost px-1.5 py-1 text-[11px]"
                                title="Trim this picture"
                                onClick={() => onCrop(field.key, value, field)}
                              >
                                <CropIcon size={13} />
                              </button>
                            ) : null}
                            {value ? (
                              <button
                                className="btn-ghost px-1.5 py-1 text-[11px] text-red-600"
                                title={
                                  field.defaultValue
                                    ? "Back to the template image"
                                    : "Remove this image"
                                }
                                onClick={() => onSetValue(field.key, "")}
                              >
                                <Trash2 size={13} />
                              </button>
                            ) : null}
                          </div>
                          {!value && field.defaultValue ? (
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                              From template
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ) : field.multiline ? (
                      <textarea
                        className="input min-h-[54px] py-1.5 text-xs"
                        rows={2}
                        value={value}
                        placeholder={field.placeholder}
                        onFocus={() => onSelect(field.id, field.side)}
                        onChange={(e) => onSetValue(field.key, e.target.value)}
                      />
                    ) : (
                      <input
                        className="input py-1.5 text-xs"
                        value={value}
                        placeholder={field.placeholder}
                        onFocus={() => onSelect(field.id, field.side)}
                        onChange={(e) => onSetValue(field.key, e.target.value)}
                      />
                    )}

                    {field.helpText ? (
                      <p className="mt-1 text-[10px] text-slate-400">{field.helpText}</p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
