"use client";

import {
  CardRecord,
  CardTemplate,
  PT_TO_MM,
  ResolvedField,
  Side,
} from "./types";
import {
  UNITS_PER_MM,
  displayText,
  fieldValue,
  prepareArtwork,
  resolveFields,
} from "./render";
import { buildFontStyle, ensureFontsReady } from "./embed-fonts";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

let measureCtx: CanvasRenderingContext2D | null = null;
function measure(text: string, font: string, letterSpacingPx: number): number {
  if (!measureCtx) {
    const canvas = document.createElement("canvas");
    measureCtx = canvas.getContext("2d");
  }
  if (!measureCtx) return text.length * 6;
  measureCtx.font = font;
  return measureCtx.measureText(text).width + letterSpacingPx * Math.max(text.length - 1, 0);
}

function wrapLines(
  text: string,
  maxWidth: number,
  font: string,
  letterSpacing: number,
): string[] {
  const paragraphs = text.split("\n");
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let current = words[0];
    for (let i = 1; i < words.length; i += 1) {
      const candidate = `${current} ${words[i]}`;
      if (measure(candidate, font, letterSpacing) <= maxWidth) {
        current = candidate;
      } else {
        lines.push(current);
        current = words[i];
      }
    }
    lines.push(current);
  }
  return lines;
}

function fieldToSvg(field: ResolvedField, raw: string): string {
  const u = UNITS_PER_MM;
  const { layout, style } = field;
  const x = layout.x * u;
  const y = layout.y * u;
  const w = layout.width * u;
  const h = layout.height * u;
  const rotate = layout.rotation
    ? ` transform="rotate(${layout.rotation} ${x + w / 2} ${y + h / 2})"`
    : "";

  const parts: string[] = [];

  const hasFill = style.backgroundColor && style.backgroundColor !== "transparent";
  const hasStroke = style.borderWidth > 0 && style.borderColor !== "transparent";
  if (hasFill || hasStroke) {
    parts.push(
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${style.cornerRadius * u}" ` +
        `fill="${hasFill ? style.backgroundColor : "none"}" ` +
        `stroke="${hasStroke ? style.borderColor : "none"}" ` +
        `stroke-width="${style.borderWidth * u}"/>`,
    );
  }

  if (field.type === "image") {
    if (!raw) return parts.length ? `<g${rotate} opacity="${style.opacity}">${parts.join("")}</g>` : "";
    const par =
      style.imageFit === "cover"
        ? "xMidYMid slice"
        : style.imageFit === "contain"
          ? "xMidYMid meet"
          : "none";
    const clipId = `clip-${field.id}`;
    const needsClip = style.cornerRadius > 0 || style.imageFit === "cover";
    if (needsClip) {
      parts.push(
        `<defs><clipPath id="${clipId}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${style.cornerRadius * u}"/></clipPath></defs>`,
      );
    }
    parts.push(
      `<image href="${escapeXml(raw)}" x="${x}" y="${y}" width="${w}" height="${h}" ` +
        `preserveAspectRatio="${par}"${needsClip ? ` clip-path="url(#${clipId})"` : ""}/>`,
    );
    return `<g${rotate} opacity="${style.opacity}">${parts.join("")}</g>`;
  }

  const text = displayText(field, raw, false);
  if (!text) return parts.length ? `<g${rotate} opacity="${style.opacity}">${parts.join("")}</g>` : "";

  const fontSize = style.fontSize * PT_TO_MM * u;
  const letterSpacing = style.letterSpacing * PT_TO_MM * u;
  const font = `${style.fontStyle} ${style.fontWeight} ${fontSize}px ${style.fontFamily}`;
  const lines = field.multiline ? wrapLines(text, w, font, letterSpacing) : [text];
  const lineHeight = fontSize * style.lineHeight;
  const blockHeight = lines.length * lineHeight;

  let startY: number;
  if (style.verticalAlign === "top") startY = y + fontSize * 0.86;
  else if (style.verticalAlign === "bottom") startY = y + h - blockHeight + fontSize * 0.86;
  else startY = y + (h - blockHeight) / 2 + fontSize * 0.86;

  const anchor = style.align === "left" ? "start" : style.align === "right" ? "end" : "middle";
  const textX = style.align === "left" ? x : style.align === "right" ? x + w : x + w / 2;

  const tspans = lines
    .map(
      (line, index) =>
        `<tspan x="${textX}" y="${startY + index * lineHeight}">${escapeXml(line)}</tspan>`,
    )
    .join("");

  parts.push(
    `<text font-family="${escapeXml(style.fontFamily)}" font-size="${fontSize}" ` +
      `font-weight="${style.fontWeight}" font-style="${style.fontStyle}" ` +
      `fill="${style.color}" text-anchor="${anchor}" ` +
      `letter-spacing="${letterSpacing}" xml:space="preserve">${tspans}</text>`,
  );

  return `<g${rotate} opacity="${style.opacity}">${parts.join("")}</g>`;
}

export function buildCardSvg(
  template: CardTemplate,
  card: CardRecord | null,
  side: Side,
  options: { pixelWidth?: number; pixelHeight?: number } = {},
): string {
  const u = UNITS_PER_MM;
  const vbWidth = template.widthMm * u;
  const vbHeight = template.heightMm * u;
  const artwork = prepareArtwork(side === "front" ? template.frontSvg : template.backSvg, `x${side}`);
  const nested = artwork.replace(
    /<svg\b/i,
    `<svg x="0" y="0" width="${vbWidth}" height="${vbHeight}"`,
  );

  const fields = resolveFields(template, card, side)
    .filter((f) => !f.hidden)
    .map((f) => fieldToSvg(f, fieldValue(f, card)))
    .join("");

  // Items the user added to this card sit above the template's own fields.
  const extras = (card?.elements ?? [])
    .filter((el) => el.side === side && el.value)
    .map((el) =>
      fieldToSvg(
        {
          ...el,
          type: el.kind === "text" ? "text" : "image",
          multiline: true,
        } as unknown as ResolvedField,
        el.value,
      ),
    )
    .join("");

  const sizeAttrs =
    options.pixelWidth && options.pixelHeight
      ? `width="${options.pixelWidth}" height="${options.pixelHeight}"`
      : `width="${template.widthMm}mm" height="${template.heightMm}mm"`;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
    `${sizeAttrs} viewBox="0 0 ${vbWidth} ${vbHeight}">` +
    `${nested}${fields}${extras}</svg>`
  );
}

/**
 * Same card, with the font bytes travelling inside it.
 *
 * Use this for anything that leaves the page — an SVG drawn through an <img>
 * or saved to disk cannot reach the fonts the page has loaded.
 */
export async function buildCardSvgEmbedded(
  template: CardTemplate,
  card: CardRecord | null,
  side: Side,
  options: { pixelWidth?: number; pixelHeight?: number } = {},
): Promise<string> {
  await ensureFontsReady();
  const markup = buildCardSvg(template, card, side, options);
  const fontStyle = await buildFontStyle(markup);
  if (!fontStyle) return markup;
  // Slot the faces in immediately after the opening tag so they apply to all of it.
  return markup.replace(/(<svg\b[^>]*>)/i, `$1${fontStyle}`);
}

export async function svgToPngBlob(
  svgMarkup: string,
  widthPx: number,
  heightPx: number,
): Promise<Blob> {
  const svgBlob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Could not render the card artwork."));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = widthPx;
    canvas.height = heightPx;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not available in this browser.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, widthPx, heightPx);
    ctx.drawImage(image, 0, 0, widthPx, heightPx);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Export failed."))),
        "image/png",
      );
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function exportCardPng(
  template: CardTemplate,
  card: CardRecord | null,
  side: Side,
  dpi = 300,
): Promise<Blob> {
  const widthPx = Math.round((template.widthMm / 25.4) * dpi);
  const heightPx = Math.round((template.heightMm / 25.4) * dpi);
  const svg = await buildCardSvgEmbedded(template, card, side, {
    pixelWidth: widthPx,
    pixelHeight: heightPx,
  });
  return svgToPngBlob(svg, widthPx, heightPx);
}
