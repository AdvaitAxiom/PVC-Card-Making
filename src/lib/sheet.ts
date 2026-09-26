"use client";

import { A4, CardTemplate, SheetLayout, Side } from "@/lib/types";
import { MM_TO_PX } from "@/lib/render";

export interface SheetSlot {
  key: string;
  cardId: string;
  side: Side;
  xMm: number;
  yMm: number;
}

/** How many cards fit across and down before running off the paper. */
export function maxGrid(template: CardTemplate, layout: SheetLayout) {
  const usableW = A4.widthMm - layout.marginLeft * 2;
  const usableH = A4.heightMm - layout.marginTop * 2;
  const columns = Math.max(
    1,
    Math.floor((usableW + layout.gapX) / (template.widthMm + layout.gapX)),
  );
  const rows = Math.max(
    1,
    Math.floor((usableH + layout.gapY) / (template.heightMm + layout.gapY)),
  );
  return { columns, rows };
}

/**
 * Places the requested cards on as many sheets as it takes.
 * With "both", the front and back of a card are kept next to each other.
 */
export function buildSheets(
  cardIds: string[],
  template: CardTemplate,
  layout: SheetLayout,
): SheetSlot[][] {
  const limits = maxGrid(template, layout);
  const columns = Math.min(Math.max(1, layout.columns), limits.columns);
  const rows = Math.min(Math.max(1, layout.rows), limits.rows);
  const perSheet = columns * rows;

  const wanted: { cardId: string; side: Side }[] = [];
  for (const id of cardIds) {
    if (layout.content === "both") {
      wanted.push({ cardId: id, side: "front" });
      wanted.push({ cardId: id, side: "back" });
    } else {
      wanted.push({ cardId: id, side: layout.content });
    }
  }

  const sheets: SheetSlot[][] = [];
  for (let i = 0; i < wanted.length; i += perSheet) {
    const chunk = wanted.slice(i, i + perSheet);
    sheets.push(
      chunk.map((item, index) => {
        const col = index % columns;
        const row = Math.floor(index / columns);
        return {
          key: `${item.cardId}-${item.side}-${i + index}`,
          cardId: item.cardId,
          side: item.side,
          xMm: layout.marginLeft + col * (template.widthMm + layout.gapX),
          yMm: layout.marginTop + row * (template.heightMm + layout.gapY),
        };
      }),
    );
  }

  return sheets.length > 0 ? sheets : [[]];
}

/** Millimetres to on-screen pixels at a given zoom. */
export function mm(value: number, scale: number): number {
  return value * MM_TO_PX * scale;
}

export function sheetSummary(
  cardCount: number,
  template: CardTemplate,
  layout: SheetLayout,
) {
  const limits = maxGrid(template, layout);
  const columns = Math.min(Math.max(1, layout.columns), limits.columns);
  const rows = Math.min(Math.max(1, layout.rows), limits.rows);
  const perSheet = columns * rows;
  const pieces = layout.content === "both" ? cardCount * 2 : cardCount;
  const sheets = Math.max(1, Math.ceil(pieces / perSheet));
  return { columns, rows, perSheet, pieces, sheets, limits };
}
