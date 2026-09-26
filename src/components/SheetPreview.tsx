"use client";

import { CardRecord, CardTemplate, SheetLayout, A4 } from "@/lib/types";
import { MM_TO_PX } from "@/lib/render";
import { SheetSlot } from "@/lib/sheet";
import CardCanvas from "./CardCanvas";

/** One A4 page with cards laid out on it, at whatever zoom is asked for. */
export default function SheetPreview({
  slots,
  cards,
  template,
  layout,
  scale,
  pageNumber,
}: {
  slots: SheetSlot[];
  cards: Record<string, CardRecord>;
  template: CardTemplate;
  layout: SheetLayout;
  scale: number;
  pageNumber: number;
}) {
  const pxTrue = (v: number) => v * MM_TO_PX;

  return (
    /* The wrapper takes the zoomed size; the sheet itself stays at true
       millimetre size and is only visually scaled, so printing is exact. */
    <div
      className="sheet-zoom shrink-0"
      style={{
        width: pxTrue(A4.widthMm) * scale,
        height: pxTrue(A4.heightMm) * scale,
      }}
    >
      <div
        className="print-page relative bg-white shadow-lg print:shadow-none"
        style={{
          width: pxTrue(A4.widthMm),
          height: pxTrue(A4.heightMm),
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
        data-sheet={pageNumber}
      >
        {slots.map((slot) => {
          const card = cards[slot.cardId];
          if (!card) return null;
          return (
            <div
              key={slot.key}
              className="absolute"
              style={{ left: pxTrue(slot.xMm), top: pxTrue(slot.yMm) }}
            >
              {layout.cutMarks ? (
                <CutMarks
                  widthPx={pxTrue(template.widthMm)}
                  heightPx={pxTrue(template.heightMm)}
                  lengthPx={pxTrue(3)}
                />
              ) : null}
              <CardCanvas
                template={template}
                card={card}
                side={slot.side}
                pxPerMm={MM_TO_PX}
                showPlaceholders={false}
                hiddenOutlines
                idPrefix={`sheet-${pageNumber}-${slot.key}`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Thin corner ticks just outside the card, to cut or guillotine along. */
function CutMarks({
  widthPx,
  heightPx,
  lengthPx,
}: {
  widthPx: number;
  heightPx: number;
  lengthPx: number;
}) {
  const gap = 1.5;
  const marks: React.CSSProperties[] = [
    { left: -lengthPx - gap, top: 0, width: lengthPx, height: 1 },
    { left: 0, top: -lengthPx - gap, width: 1, height: lengthPx },
    { left: widthPx + gap, top: 0, width: lengthPx, height: 1 },
    { left: widthPx - 1, top: -lengthPx - gap, width: 1, height: lengthPx },
    { left: -lengthPx - gap, top: heightPx - 1, width: lengthPx, height: 1 },
    { left: 0, top: heightPx + gap, width: 1, height: lengthPx },
    { left: widthPx + gap, top: heightPx - 1, width: lengthPx, height: 1 },
    { left: widthPx - 1, top: heightPx + gap, width: 1, height: lengthPx },
  ];
  return (
    <div className="pointer-events-none absolute inset-0">
      {marks.map((style, i) => (
        <span key={i} className="absolute bg-slate-400" style={style} />
      ))}
    </div>
  );
}
