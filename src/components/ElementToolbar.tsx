"use client";

import { useEffect, useRef, useState } from "react";
import {
  Crop as CropIcon,
  ImagePlus,
  PenLine,
  QrCode,
  Trash2,
  Type as TypeIcon,
} from "lucide-react";
import {
  CardElement,
  DEFAULT_STYLE,
  ElementKind,
  Side,
} from "@/lib/types";
import { cx, uid } from "@/lib/utils";
import { readImageScaled } from "@/lib/image";
import { makeQrDataUrl } from "@/lib/qr";

const KIND_ICON = {
  text: TypeIcon,
  image: ImagePlus,
  qr: QrCode,
  signature: PenLine,
} as const;

export function makeElement(kind: ElementKind, side: Side, index: number): CardElement {
  const base = {
    id: uid("el"),
    kind,
    side,
    locked: false,
  };

  if (kind === "text") {
    return {
      ...base,
      label: `Text ${index}`,
      value: "New text",
      layout: { x: 8, y: 8 + (index % 6) * 6, width: 40, height: 6, rotation: 0 },
      style: { ...DEFAULT_STYLE, fontSize: 8, fontWeight: 600 },
    };
  }
  if (kind === "qr") {
    return {
      ...base,
      label: `QR ${index}`,
      value: "",
      layout: { x: 60, y: 8, width: 18, height: 18, rotation: 0 },
      style: { ...DEFAULT_STYLE, imageFit: "contain" },
    };
  }
  if (kind === "signature") {
    return {
      ...base,
      label: `Signature ${index}`,
      value: "",
      layout: { x: 8, y: 40, width: 30, height: 9, rotation: 0 },
      style: { ...DEFAULT_STYLE, imageFit: "contain" },
    };
  }
  return {
    ...base,
    label: `Image ${index}`,
    value: "",
    layout: { x: 8, y: 14, width: 22, height: 26, rotation: 0 },
    style: { ...DEFAULT_STYLE, imageFit: "cover" },
  };
}

export default function ElementToolbar({
  elements,
  side,
  selectedId,
  onSelect,
  onAdd,
  onChange,
  onRemove,
  onOpenSignature,
  onCrop,
}: {
  elements: CardElement[];
  side: Side;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: (kind: ElementKind) => void;
  onChange: (id: string, patch: Partial<CardElement>) => void;
  onRemove: (id: string) => void;
  onOpenSignature: (id: string) => void;
  onCrop?: (element: CardElement) => void;
}) {
  const [qrBusy, setQrBusy] = useState<string | null>(null);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const mine = elements.filter((el) => el.side === side);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      Object.values(pending).forEach(clearTimeout);
    };
  }, []);

  /**
   * Regenerates the picture shortly after typing stops, so the code on the card
   * always matches what is in the box — even if the user never clicks away.
   */
  function setQrText(element: CardElement, text: string) {
    onChange(element.id, { label: text });
    clearTimeout(timers.current[element.id]);
    timers.current[element.id] = setTimeout(async () => {
      setQrBusy(element.id);
      try {
        const dataUrl = await makeQrDataUrl(text);
        onChange(element.id, { value: dataUrl });
      } catch {
        onChange(element.id, { value: "" });
      } finally {
        setQrBusy(null);
      }
    }, 500);
  }

  async function setImage(element: CardElement, file: File | undefined) {
    if (!file) return;
    const dataUrl = await readImageScaled(file);
    onChange(element.id, { value: dataUrl });
  }

  return (
    <div className="card-panel">
      <div className="border-b border-slate-200 px-4 py-3">
        <p className="text-sm font-bold text-slate-900">Add your own</p>
        <p className="mt-0.5 text-xs text-slate-500">
          Extra items for this card only — they do not change the template.
        </p>
        <div className="mt-2.5 grid grid-cols-4 gap-1.5">
          {(["text", "image", "qr", "signature"] as ElementKind[]).map((kind) => {
            const Icon = KIND_ICON[kind];
            return (
              <button
                key={kind}
                className="btn-secondary flex-col gap-1 px-1 py-2 text-[10px] capitalize"
                onClick={() => onAdd(kind)}
                title={`Add ${kind}`}
              >
                <Icon size={15} />
                {kind}
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-h-[320px] overflow-y-auto p-2">
        {mine.length === 0 ? (
          <p className="px-2 py-5 text-center text-xs text-slate-400">
            Nothing added to the {side} yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {mine.map((element) => {
              const Icon = KIND_ICON[element.kind];
              const active = selectedId === element.id;
              return (
                <li
                  key={element.id}
                  className={cx(
                    "rounded-lg border p-2.5 transition",
                    active ? "border-brand-400 bg-brand-50/40" : "border-slate-200",
                  )}
                >
                  <div className="mb-1.5 flex items-center gap-2">
                    <button
                      className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                      onClick={() => onSelect(element.id)}
                    >
                      <Icon size={13} className="shrink-0 text-slate-400" />
                      <span className="truncate text-xs font-semibold text-slate-700">
                        {element.label}
                      </span>
                    </button>
                    <button
                      className="shrink-0 text-slate-400 hover:text-red-600"
                      title="Remove"
                      onClick={() => onRemove(element.id)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  {element.kind === "text" ? (
                    <textarea
                      className="input min-h-[46px] py-1.5 text-xs"
                      rows={2}
                      value={element.value}
                      placeholder="Type anything"
                      onFocus={() => onSelect(element.id)}
                      onChange={(e) => onChange(element.id, { value: e.target.value })}
                    />
                  ) : element.kind === "qr" ? (
                    <div className="flex items-center gap-2">
                      {element.value ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={element.value}
                          alt="QR"
                          className="h-11 w-11 shrink-0 rounded border border-slate-200"
                        />
                      ) : null}
                      <input
                        className="input py-1.5 text-xs"
                        placeholder="Link or text to encode"
                        value={element.label.startsWith("QR ") ? "" : element.label}
                        onFocus={() => onSelect(element.id)}
                        onChange={(e) => setQrText(element, e.target.value)}
                      />
                      {qrBusy === element.id ? (
                        <span className="text-[10px] text-slate-400">…</span>
                      ) : null}
                    </div>
                  ) : element.kind === "signature" ? (
                    <div className="flex items-center gap-2">
                      {element.value ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={element.value}
                          alt="Signature"
                          className="checker h-11 w-16 shrink-0 rounded border border-slate-200 object-contain"
                        />
                      ) : null}
                      <button
                        className="btn-secondary px-2.5 py-1.5 text-xs"
                        onClick={() => onOpenSignature(element.id)}
                      >
                        <PenLine size={13} />
                        {element.value ? "Redraw" : "Sign"}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      {element.value ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={element.value}
                          alt={element.label}
                          className="checker h-11 w-11 shrink-0 rounded border border-slate-200 object-contain"
                        />
                      ) : null}
                      <div className="flex min-w-0 flex-col gap-1">
                        <label className="btn-secondary cursor-pointer px-2.5 py-1.5 text-xs">
                          <ImagePlus size={13} />
                          {element.value ? "Replace" : "Upload"}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              setImage(element, e.target.files?.[0]);
                              e.target.value = "";
                            }}
                          />
                        </label>
                        {element.value && onCrop ? (
                          <button
                            className="btn-ghost px-2 py-1 text-[11px]"
                            onClick={() => onCrop(element)}
                          >
                            <CropIcon size={12} />
                            Trim
                          </button>
                        ) : null}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
