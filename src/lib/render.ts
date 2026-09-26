import type { CSSProperties } from "react";
import {
  CardRecord,
  CardTemplate,
  FieldOverride,
  PT_TO_MM,
  ResolvedField,
  Side,
  TemplateField,
} from "./types";

/** CSS pixels per millimetre at the standard 96dpi CSS reference. */
export const MM_TO_PX = 96 / 25.4;

/** Artwork coordinate units per millimetre (856 x 540 viewBox for a CR80 card). */
export const UNITS_PER_MM = 10;

/**
 * Makes an uploaded SVG safe to inline and prevents `id` collisions when two
 * templates (or the front and back of one card) are on the page together.
 */
export function sanitizeSvg(svg: string, idPrefix: string): string {
  if (!svg || !svg.includes("<svg")) return "";

  let out = svg
    .replace(/<\?xml[\s\S]*?\?>/gi, "")
    .replace(/<!DOCTYPE[\s\S]*?>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "")
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "")
    .replace(/javascript:/gi, "");

  const ids = new Set<string>();
  for (const match of out.matchAll(/\sid\s*=\s*["']([^"']+)["']/g)) {
    ids.add(match[1]);
  }

  const safePrefix = idPrefix.replace(/[^a-zA-Z0-9_-]/g, "");
  for (const id of ids) {
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out
      .replace(new RegExp(`(\\sid\\s*=\\s*["'])${escaped}(["'])`, "g"), `$1${safePrefix}-${id}$2`)
      .replace(new RegExp(`url\\(\\s*#${escaped}\\s*\\)`, "g"), `url(#${safePrefix}-${id})`)
      .replace(new RegExp(`((?:xlink:)?href\\s*=\\s*["'])#${escaped}(["'])`, "g"), `$1#${safePrefix}-${id}$2`);
  }

  return out;
}

/** Strips the root `width`/`height` so the artwork stretches to its container. */
export function makeResponsiveSvg(svg: string): string {
  return svg.replace(/<svg\b[^>]*>/i, (tag) => {
    let next = tag
      .replace(/\swidth\s*=\s*["'][^"']*["']/i, "")
      .replace(/\sheight\s*=\s*["'][^"']*["']/i, "");
    if (!/viewBox/i.test(next)) {
      const w = /width\s*=\s*["']([\d.]+)/i.exec(tag)?.[1] ?? "856";
      const h = /height\s*=\s*["']([\d.]+)/i.exec(tag)?.[1] ?? "540";
      next = next.replace("<svg", `<svg viewBox="0 0 ${w} ${h}"`);
    }
    if (!/preserveAspectRatio/i.test(next)) {
      next = next.replace("<svg", `<svg preserveAspectRatio="none"`);
    }
    return next;
  });
}

export function prepareArtwork(svg: string, idPrefix: string): string {
  return makeResponsiveSvg(sanitizeSvg(svg, idPrefix));
}

export function resolveField(field: TemplateField, override?: FieldOverride): ResolvedField {
  return {
    ...field,
    layout: { ...field.layout, ...(override?.layout ?? {}) },
    style: { ...field.style, ...(override?.style ?? {}) },
    hidden: override?.hidden ?? false,
  };
}

export function resolveFields(
  template: CardTemplate,
  card: CardRecord | null,
  side?: Side,
): ResolvedField[] {
  return template.fields
    .filter((f) => (side ? f.side === side : true))
    .map((f) => resolveField(f, card?.overrides?.[f.id]));
}

export function fieldValue(field: TemplateField, card: CardRecord | null): string {
  const raw = card?.values?.[field.key];
  if (raw !== undefined && raw !== "") return raw;
  return field.defaultValue ?? "";
}

export function displayText(field: ResolvedField, raw: string, showPlaceholder: boolean): string {
  const text = raw || (showPlaceholder ? field.placeholder || field.label : "");
  switch (field.style.textTransform) {
    case "uppercase":
      return text.toUpperCase();
    case "lowercase":
      return text.toLowerCase();
    case "capitalize":
      return text.replace(/\b\w/g, (c) => c.toUpperCase());
    default:
      return text;
  }
}

export function fontSizePx(sizePt: number, pxPerMm: number): number {
  return sizePt * PT_TO_MM * pxPerMm;
}

export function boxStyle(field: ResolvedField, pxPerMm: number): CSSProperties {
  const { layout, style } = field;
  return {
    position: "absolute",
    left: layout.x * pxPerMm,
    top: layout.y * pxPerMm,
    width: layout.width * pxPerMm,
    height: layout.height * pxPerMm,
    transform: layout.rotation ? `rotate(${layout.rotation}deg)` : undefined,
    transformOrigin: "center center",
    opacity: style.opacity,
    backgroundColor: style.backgroundColor === "transparent" ? undefined : style.backgroundColor,
    borderRadius: style.cornerRadius ? style.cornerRadius * pxPerMm : undefined,
    border:
      style.borderWidth > 0 && style.borderColor !== "transparent"
        ? `${Math.max(style.borderWidth * pxPerMm, 0.5)}px solid ${style.borderColor}`
        : undefined,
    boxSizing: "border-box",
  };
}

export function textStyle(field: ResolvedField, pxPerMm: number): CSSProperties {
  const { style } = field;
  const size = fontSizePx(style.fontSize, pxPerMm);
  return {
    display: "flex",
    width: "100%",
    height: "100%",
    alignItems:
      style.verticalAlign === "top"
        ? "flex-start"
        : style.verticalAlign === "bottom"
          ? "flex-end"
          : "center",
    justifyContent:
      style.align === "left" ? "flex-start" : style.align === "right" ? "flex-end" : "center",
    fontFamily: style.fontFamily,
    fontSize: size,
    fontWeight: style.fontWeight,
    fontStyle: style.fontStyle,
    color: style.color,
    textAlign: style.align,
    letterSpacing: style.letterSpacing ? fontSizePx(style.letterSpacing, pxPerMm) : undefined,
    lineHeight: style.lineHeight,
    whiteSpace: field.multiline ? "pre-wrap" : "nowrap",
    overflowWrap: field.multiline ? "break-word" : "normal",
    padding: 0,
    margin: 0,
  };
}

export function imageStyle(field: ResolvedField): CSSProperties {
  return {
    width: "100%",
    height: "100%",
    objectFit: field.style.imageFit,
    display: "block",
    borderRadius: "inherit",
  };
}

export function sideLabel(side: Side): string {
  return side === "front" ? "Front" : "Back";
}
