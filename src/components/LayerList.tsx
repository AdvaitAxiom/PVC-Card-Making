"use client";

import {
  Eye,
  EyeOff,
  Image as ImageIcon,
  Lock,
  Minus,
  PenLine,
  QrCode,
  Trash2,
  Type as TypeIcon,
} from "lucide-react";
import { CardElement, ResolvedField, Side } from "@/lib/types";
import { cx } from "@/lib/utils";

const KIND_ICON = {
  text: TypeIcon,
  image: ImageIcon,
  qr: QrCode,
  signature: PenLine,
} as const;

/** Everything sitting on the current side, so any of it can be picked by name. */
export default function LayerList({
  fields,
  elements,
  side,
  selectedId,
  onSelect,
  onRemoveElement,
  onToggleHidden,
  hiddenIds,
}: {
  fields: ResolvedField[];
  elements: CardElement[];
  side: Side;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRemoveElement: (id: string) => void;
  onToggleHidden: (id: string, hidden: boolean) => void;
  hiddenIds: Set<string>;
}) {
  const mine = elements.filter((el) => el.side === side);
  const sideFields = fields.filter((f) => f.side === side);
  const empty = mine.length === 0 && sideFields.length === 0;

  return (
    <div className="p-2">
      {empty ? (
        <p className="px-2 py-8 text-center text-xs text-slate-400">
          Nothing on the {side} yet.
        </p>
      ) : null}

      {mine.length > 0 ? (
        <>
          <p className="px-2 pb-1.5 pt-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">
            Added by you
          </p>
          <ul className="mb-3 space-y-1">
            {mine.map((element) => {
              const Icon = KIND_ICON[element.kind];
              return (
                <li key={element.id}>
                  <div
                    className={cx(
                      "flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition",
                      selectedId === element.id
                        ? "bg-brand-50 font-semibold text-brand-800"
                        : "text-slate-600 hover:bg-slate-50",
                    )}
                  >
                    <button
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      onClick={() => onSelect(element.id)}
                    >
                      <Icon size={13} className="shrink-0 opacity-60" />
                      <span className="truncate">{element.label}</span>
                    </button>
                    <button
                      className="shrink-0 opacity-50 hover:text-red-600 hover:opacity-100"
                      title="Remove"
                      onClick={() => onRemoveElement(element.id)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}

      {sideFields.length > 0 ? (
        <>
          <p className="px-2 pb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">
            From the template
          </p>
          <ul className="space-y-1">
            {sideFields.map((field) => {
              const hidden = hiddenIds.has(field.id);
              return (
                <li key={field.id}>
                  <div
                    className={cx(
                      "flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition",
                      selectedId === field.id
                        ? "bg-brand-50 font-semibold text-brand-800"
                        : "text-slate-600 hover:bg-slate-50",
                      hidden && "opacity-45",
                    )}
                  >
                    <button
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      onClick={() => onSelect(field.id)}
                    >
                      {field.type === "image" ? (
                        <ImageIcon size={13} className="shrink-0 opacity-60" />
                      ) : field.type === "line" ? (
                        <Minus size={13} className="shrink-0 opacity-60" />
                      ) : (
                        <TypeIcon size={13} className="shrink-0 opacity-60" />
                      )}
                      <span className="truncate">{field.label}</span>
                    </button>
                    {field.locked ? (
                      <Lock size={12} className="shrink-0 opacity-50" />
                    ) : (
                      <button
                        className="shrink-0 opacity-50 hover:opacity-100"
                        title={hidden ? "Show on card" : "Hide from card"}
                        onClick={() => onToggleHidden(field.id, !hidden)}
                      >
                        {hidden ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </div>
  );
}
