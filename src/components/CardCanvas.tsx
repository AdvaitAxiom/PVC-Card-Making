"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CardElement,
  CardRecord,
  CardTemplate,
  FieldLayout,
  ResolvedField,
  Side,
} from "@/lib/types";
import {
  boxStyle,
  displayText,
  fieldValue,
  imageStyle,
  prepareArtwork,
  resolveFields,
  textStyle,
} from "@/lib/render";
import { clamp, cx, round } from "@/lib/utils";

type DragMode =
  | "move"
  | "nw"
  | "ne"
  | "sw"
  | "se"
  | "n"
  | "s"
  | "w"
  | "e";

interface DragState {
  fieldId: string;
  mode: DragMode;
  startX: number;
  startY: number;
  startLayout: FieldLayout;
}

export interface CardCanvasProps {
  template: CardTemplate;
  card: CardRecord | null;
  side: Side;
  pxPerMm: number;
  editable?: boolean;
  selectedFieldId?: string | null;
  onSelectField?: (id: string | null) => void;
  onLayoutChange?: (id: string, layout: FieldLayout) => void;
  showPlaceholders?: boolean;
  showGuides?: boolean;
  hiddenOutlines?: boolean;
  className?: string;
  idPrefix?: string;
}

const HANDLES: { mode: DragMode; style: React.CSSProperties; cursor: string }[] = [
  { mode: "nw", style: { left: -5, top: -5 }, cursor: "nwse-resize" },
  { mode: "n", style: { left: "calc(50% - 5px)", top: -5 }, cursor: "ns-resize" },
  { mode: "ne", style: { right: -5, top: -5 }, cursor: "nesw-resize" },
  { mode: "e", style: { right: -5, top: "calc(50% - 5px)" }, cursor: "ew-resize" },
  { mode: "se", style: { right: -5, bottom: -5 }, cursor: "nwse-resize" },
  { mode: "s", style: { left: "calc(50% - 5px)", bottom: -5 }, cursor: "ns-resize" },
  { mode: "sw", style: { left: -5, bottom: -5 }, cursor: "nesw-resize" },
  { mode: "w", style: { left: -5, top: "calc(50% - 5px)" }, cursor: "ew-resize" },
];

const MIN_SIZE_MM = 3;

export default function CardCanvas({
  template,
  card,
  side,
  pxPerMm,
  editable = false,
  selectedFieldId = null,
  onSelectField,
  onLayoutChange,
  showPlaceholders = true,
  showGuides = false,
  hiddenOutlines = false,
  className,
  idPrefix,
}: CardCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [dragging, setDragging] = useState(false);

  const artwork = useMemo(
    () =>
      prepareArtwork(
        side === "front" ? template.frontSvg : template.backSvg,
        `${idPrefix ?? template.id}-${side}`,
      ),
    [template.frontSvg, template.backSvg, template.id, side, idPrefix],
  );

  const fields = useMemo(
    () => resolveFields(template, card, side),
    [template, card, side],
  );

  /** Card-specific items are drawn on top of the template's own fields. */
  const elements = useMemo(
    () => (card?.elements ?? []).filter((el) => el.side === side),
    [card, side],
  );

  const widthPx = template.widthMm * pxPerMm;
  const heightPx = template.heightMm * pxPerMm;

  const applyLayout = useCallback(
    (fieldId: string, layout: FieldLayout) => {
      onLayoutChange?.(fieldId, {
        x: round(layout.x, 2),
        y: round(layout.y, 2),
        width: round(layout.width, 2),
        height: round(layout.height, 2),
        rotation: round(layout.rotation, 1),
      });
    },
    [onLayoutChange],
  );

  useEffect(() => {
    if (!dragging) return;

    function handleMove(event: PointerEvent) {
      const drag = dragRef.current;
      if (!drag) return;
      const dxMm = (event.clientX - drag.startX) / pxPerMm;
      const dyMm = (event.clientY - drag.startY) / pxPerMm;
      const start = drag.startLayout;
      const next: FieldLayout = { ...start };

      if (drag.mode === "move") {
        next.x = clamp(start.x + dxMm, -start.width / 2, template.widthMm - start.width / 2);
        next.y = clamp(start.y + dyMm, -start.height / 2, template.heightMm - start.height / 2);
      } else {
        if (drag.mode.includes("w")) {
          const maxDelta = start.width - MIN_SIZE_MM;
          const delta = Math.min(dxMm, maxDelta);
          next.x = start.x + delta;
          next.width = start.width - delta;
        }
        if (drag.mode.includes("e")) {
          next.width = Math.max(MIN_SIZE_MM, start.width + dxMm);
        }
        if (drag.mode.includes("n")) {
          const maxDelta = start.height - MIN_SIZE_MM;
          const delta = Math.min(dyMm, maxDelta);
          next.y = start.y + delta;
          next.height = start.height - delta;
        }
        if (drag.mode.includes("s")) {
          next.height = Math.max(MIN_SIZE_MM, start.height + dyMm);
        }
      }

      if (event.shiftKey) {
        next.x = Math.round(next.x * 2) / 2;
        next.y = Math.round(next.y * 2) / 2;
        next.width = Math.round(next.width * 2) / 2;
        next.height = Math.round(next.height * 2) / 2;
      }

      applyLayout(drag.fieldId, next);
    }

    function handleUp() {
      dragRef.current = null;
      setDragging(false);
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, [dragging, pxPerMm, template.widthMm, template.heightMm, applyLayout]);

  function startDrag(
    event: React.PointerEvent,
    item: { id: string; layout: FieldLayout; locked: boolean },
    mode: DragMode,
  ) {
    if (!editable || item.locked) return;
    event.preventDefault();
    event.stopPropagation();
    onSelectField?.(item.id);
    dragRef.current = {
      fieldId: item.id,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      startLayout: { ...item.layout },
    };
    setDragging(true);
  }

  /**
   * Arrow keys are handled once, by the page, so that they work no matter where
   * focus is. Doing it here as well would move the item twice per press.
   */

  return (
    <div
      ref={containerRef}
      data-card-surface={idPrefix ?? template.id}
      className={cx("card-surface", editable && "editable", className)}
      style={{
        width: widthPx,
        height: heightPx,
        borderRadius: template.cornerRadiusMm * pxPerMm,
      }}
      onPointerDown={() => editable && onSelectField?.(null)}
    >
      <div
        className="artwork-layer pointer-events-none absolute inset-0"
        dangerouslySetInnerHTML={{ __html: artwork }}
      />

      {showGuides ? (
        <div
          className="pointer-events-none absolute border border-dashed border-brand-400/60"
          style={{
            left: 2 * pxPerMm,
            top: 2 * pxPerMm,
            width: (template.widthMm - 4) * pxPerMm,
            height: (template.heightMm - 4) * pxPerMm,
          }}
        />
      ) : null}

      {fields.map((field) => {
        if (field.hidden) return null;
        const raw = fieldValue(field, card);
        const selected = editable && selectedFieldId === field.id;
        const isEmptyImage = field.type === "image" && !raw;
        const text = displayText(field, raw, showPlaceholders);

        if (field.type === "text" && !text && !editable) return null;
        if (isEmptyImage && !editable && !showPlaceholders) return null;

        return (
          <div
            key={field.id}
            role={editable ? "button" : undefined}
            tabIndex={editable ? 0 : undefined}
            className={cx(
              "field-box absolute",
              selected && "is-selected",
              editable && !field.locked && "cursor-move",
              editable && field.locked && "cursor-not-allowed",
            )}
            style={boxStyle(field, pxPerMm)}
            onPointerDown={(e) => startDrag(e, field, "move")}
          >
            {field.type === "image" ? (
              raw ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={raw} alt={field.label} style={imageStyle(field)} draggable={false} />
              ) : editable || showPlaceholders ? (
                <div
                  className={cx(
                    "flex h-full w-full items-center justify-center rounded-[inherit] border border-dashed text-center",
                    hiddenOutlines
                      ? "border-transparent"
                      : "border-slate-400/70 bg-slate-100/40",
                  )}
                  style={{ fontSize: Math.max(5, pxPerMm * 1.4) }}
                >
                  <span className="px-1 leading-tight text-slate-500">{field.label}</span>
                </div>
              ) : null
            ) : (
              <div style={textStyle(field, pxPerMm)}>
                <span
                  className={cx(
                    !raw && showPlaceholders && editable ? "opacity-40" : undefined,
                  )}
                >
                  {text}
                </span>
              </div>
            )}

            {selected && !field.locked
              ? HANDLES.map((handle) => (
                  <span
                    key={handle.mode}
                    className="field-handle"
                    style={{ ...handle.style, cursor: handle.cursor }}
                    onPointerDown={(e) => startDrag(e, field, handle.mode)}
                  />
                ))
              : null}
          </div>
        );
      })}

      {elements.map((element) => {
        const selected = editable && selectedFieldId === element.id;
        const asField = { ...element, type: "text", multiline: true } as unknown as ResolvedField;
        const isPicture = element.kind !== "text";
        const empty = !element.value;

        if (empty && !editable) return null;

        return (
          <div
            key={element.id}
            role={editable ? "button" : undefined}
            tabIndex={editable ? 0 : undefined}
            className={cx(
              "field-box absolute",
              selected && "is-selected",
              editable && !element.locked && "cursor-move",
            )}
            style={boxStyle(asField, pxPerMm)}
            onPointerDown={(e) => startDrag(e, element, "move")}
          >
            {isPicture ? (
              element.value ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={element.value}
                  alt={element.label}
                  style={imageStyle(asField)}
                  draggable={false}
                />
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center rounded-[inherit] border border-dashed border-slate-400/70 bg-slate-100/40 text-center"
                  style={{ fontSize: Math.max(5, pxPerMm * 1.4) }}
                >
                  <span className="px-1 leading-tight text-slate-500">{element.label}</span>
                </div>
              )
            ) : (
              <div style={textStyle(asField, pxPerMm)}>
                <span className={cx(empty && editable ? "opacity-40" : undefined)}>
                  {element.value || element.label}
                </span>
              </div>
            )}

            {selected && !element.locked
              ? HANDLES.map((handle) => (
                  <span
                    key={handle.mode}
                    className="field-handle"
                    style={{ ...handle.style, cursor: handle.cursor }}
                    onPointerDown={(e) => startDrag(e, element, handle.mode)}
                  />
                ))
              : null}
          </div>
        );
      })}
    </div>
  );
}
