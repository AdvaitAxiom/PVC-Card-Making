"use client";

import {
  DEFAULT_STYLE,
  FieldStyle,
  PT_TO_MM,
  Side,
  TemplateField,
  TextAlign,
} from "./types";
import { round, slugKey, uid } from "./utils";

function toHex(value: string | null | undefined): string {
  if (!value) return "#111827";
  if (value.startsWith("#")) return value;
  const match = /rgba?\(([^)]+)\)/.exec(value);
  if (!match) return "#111827";
  const parts = match[1].split(",").map((v) => parseFloat(v.trim()));
  if (parts.length < 3 || parts.some((n) => !Number.isFinite(n))) return "#111827";
  return (
    "#" +
    parts
      .slice(0, 3)
      .map((n) => Math.round(n).toString(16).padStart(2, "0"))
      .join("")
  );
}

function uniqueKey(base: string, used: Set<string>): string {
  const root = slugKey(base).slice(0, 26) || "text";
  let key = root;
  let n = 2;
  while (used.has(key)) {
    key = `${root}_${n}`;
    n += 1;
  }
  used.add(key);
  return key;
}

/**
 * Reads the artwork that is currently on screen and turns every piece of text in it
 * into an editable field placed at exactly the same spot, in the same font.
 */
export function extractTextFields(
  surface: HTMLElement,
  widthMm: number,
  side: Side,
  existingKeys: string[],
): TemplateField[] {
  const svg = surface.querySelector(".artwork-layer > svg");
  if (!svg) return [];

  const surfaceRect = surface.getBoundingClientRect();
  const pxPerMm = surfaceRect.width / widthMm;
  if (!pxPerMm || !Number.isFinite(pxPerMm)) return [];

  const used = new Set(existingKeys);
  const fields: TemplateField[] = [];

  Array.from(svg.querySelectorAll("text")).forEach((node, index) => {
    const flat = (node.textContent ?? "").replace(/\s+/g, " ").trim();
    if (!flat) return;

    const rect = node.getBoundingClientRect();
    if (rect.width < 0.5 || rect.height < 0.5) return;

    // getComputedStyle reports SVG *user units*, so convert through the element's
    // own screen transform before working out real-world sizes.
    const ctm = node.getScreenCTM();
    const unitScale = ctm
      ? Math.sqrt(Math.abs(ctm.a * ctm.d - ctm.b * ctm.c)) || 1
      : 1;

    const cs = getComputedStyle(node);
    const fontSizePx = (parseFloat(cs.fontSize) || 12) * unitScale;
    const fontSizePt = fontSizePx / pxPerMm / PT_TO_MM;

    const anchor = cs.getPropertyValue("text-anchor").trim() || "start";
    const align: TextAlign =
      anchor === "middle" ? "center" : anchor === "end" ? "right" : "left";

    const spacingPx = parseFloat(cs.letterSpacing) * unitScale;
    const letterSpacing = Number.isFinite(spacingPx)
      ? round(spacingPx / pxPerMm / PT_TO_MM, 2)
      : 0;

    const tspans = Array.from(node.querySelectorAll("tspan"));
    const distinctRows = new Set(tspans.map((t) => t.getAttribute("y")).filter(Boolean));
    const multiline = distinctRows.size > 1;
    const text = multiline
      ? tspans
          .map((t) => (t.textContent ?? "").trim())
          .filter(Boolean)
          .join("\n")
      : flat;

    const pad = fontSizePt * PT_TO_MM * 0.3;
    const left = (rect.left - surfaceRect.left) / pxPerMm;
    const top = (rect.top - surfaceRect.top) / pxPerMm;
    const width = rect.width / pxPerMm;
    const height = rect.height / pxPerMm;

    // Keep the anchor point fixed while giving the box a little breathing room.
    const x = align === "center" ? left - pad : align === "right" ? left - pad * 2 : left;

    const style: FieldStyle = {
      ...DEFAULT_STYLE,
      fontFamily: cs.fontFamily || DEFAULT_STYLE.fontFamily,
      fontSize: round(fontSizePt, 1),
      fontWeight: Number(cs.fontWeight) || 400,
      fontStyle: cs.fontStyle === "italic" ? "italic" : "normal",
      color: toHex(cs.fill || cs.color),
      align,
      verticalAlign: "middle",
      letterSpacing,
      lineHeight: multiline ? 1.2 : 1,
    };

    fields.push({
      id: uid("fld"),
      key: uniqueKey(flat || `text_${index + 1}`, used),
      label: flat.length > 34 ? `${flat.slice(0, 34)}…` : flat,
      type: "text",
      side,
      required: false,
      multiline,
      placeholder: text,
      defaultValue: text,
      helpText: "",
      layout: {
        x: round(x, 2),
        y: round(top - pad / 2, 2),
        width: round(width + pad * 2, 2),
        height: round(height + pad, 2),
        rotation: 0,
      },
      style,
      locked: false,
    });
  });

  return fields;
}

/** Removes the text from artwork once it has been turned into editable fields. */
export function stripTextFromSvg(svg: string): string {
  try {
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    if (doc.querySelector("parsererror")) return svg;
    doc.querySelectorAll("text").forEach((node) => node.remove());
    return new XMLSerializer().serializeToString(doc.documentElement);
  } catch {
    return svg;
  }
}

/** Counts how many text items an artwork string contains, for messaging. */
export function countSvgText(svg: string): number {
  try {
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    if (doc.querySelector("parsererror")) return 0;
    return Array.from(doc.querySelectorAll("text")).filter(
      (n) => (n.textContent ?? "").trim().length > 0,
    ).length;
  } catch {
    return 0;
  }
}
