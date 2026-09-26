export type Side = "front" | "back";

export type FieldType = "text" | "image";

export type TextAlign = "left" | "center" | "right";
export type VerticalAlign = "top" | "middle" | "bottom";
export type TextTransform = "none" | "uppercase" | "lowercase" | "capitalize";
export type ImageFit = "cover" | "contain" | "fill";

/** All geometry is expressed in millimetres, measured from the top-left of the card. */
export interface FieldLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export interface FieldStyle {
  fontFamily: string;
  /** Font size in points (1pt = 0.3528mm) — the unit non-technical users know from Word. */
  fontSize: number;
  fontWeight: number;
  fontStyle: "normal" | "italic";
  color: string;
  align: TextAlign;
  verticalAlign: VerticalAlign;
  /** Extra spacing between letters, in points. */
  letterSpacing: number;
  lineHeight: number;
  textTransform: TextTransform;
  opacity: number;
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  cornerRadius: number;
  imageFit: ImageFit;
}

export interface TemplateField {
  id: string;
  /** Stable key used to look up the user's value. */
  key: string;
  label: string;
  type: FieldType;
  side: Side;
  required: boolean;
  multiline: boolean;
  placeholder: string;
  defaultValue: string;
  helpText: string;
  layout: FieldLayout;
  style: FieldStyle;
  locked: boolean;
}

export interface CardTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  widthMm: number;
  heightMm: number;
  cornerRadiusMm: number;
  frontSvg: string;
  backSvg: string;
  fields: TemplateField[];
  builtIn: boolean;
  /** Fingerprint of the shipped version, used to spot a changed card. */
  contentHash?: string;
  createdAt: number;
  updatedAt: number;
}

export interface FieldOverride {
  layout?: Partial<FieldLayout>;
  style?: Partial<FieldStyle>;
  hidden?: boolean;
}

/** Something the user adds to one particular card, on top of the template. */
export type ElementKind = "text" | "image" | "qr" | "signature";

export interface CardElement {
  id: string;
  kind: ElementKind;
  side: Side;
  label: string;
  /** Typed text, a data URL for pictures, or the payload a QR code encodes. */
  value: string;
  layout: FieldLayout;
  style: FieldStyle;
  locked: boolean;
}

export interface CardRecord {
  id: string;
  templateId: string;
  title: string;
  values: Record<string, string>;
  overrides: Record<string, FieldOverride>;
  /** Extra items belonging only to this card. Older saved cards may omit it. */
  elements?: CardElement[];
  createdAt: number;
  updatedAt: number;
}

export interface ResolvedField extends TemplateField {
  hidden: boolean;
}

/** One A4 sheet's worth of layout settings. */
export interface SheetLayout {
  columns: number;
  rows: number;
  /** Space between cards, in millimetres. */
  gapX: number;
  gapY: number;
  marginTop: number;
  marginLeft: number;
  cutMarks: boolean;
  /** What to place on the sheet. */
  content: "front" | "back" | "both";
}

export const A4 = { widthMm: 210, heightMm: 297 };

export const DEFAULT_SHEET: SheetLayout = {
  columns: 2,
  rows: 5,
  gapX: 4,
  gapY: 4,
  marginTop: 10,
  marginLeft: 10,
  cutMarks: true,
  content: "both",
};

export interface BackupFile {
  kind: "pvc-card-maker-backup";
  version: 1;
  exportedAt: string;
  templates: CardTemplate[];
  cards: CardRecord[];
}

export const CR80 = { widthMm: 85.6, heightMm: 54, cornerRadiusMm: 3.18 };

export const PT_TO_MM = 0.352777778;

export const FONT_OPTIONS = [
  // Variable fonts first: every weight below really is a different shape.
  { label: "Card Sans (all weights)", value: "'Card Sans', Arial, sans-serif", variable: true },
  { label: "Card Serif (all weights)", value: "'Card Serif', Georgia, serif", variable: true },
  { label: "Card Mono (all weights)", value: "'Card Mono', Consolas, monospace", variable: true },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Helvetica", value: "Helvetica, Arial, sans-serif" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { label: "Tahoma", value: "Tahoma, Geneva, sans-serif" },
  { label: "Trebuchet MS", value: "'Trebuchet MS', Helvetica, sans-serif" },
  { label: "Segoe UI", value: "'Segoe UI', Tahoma, sans-serif" },
  { label: "Times New Roman", value: "'Times New Roman', Times, serif" },
  { label: "Georgia", value: "Georgia, 'Times New Roman', serif" },
  { label: "Garamond", value: "Garamond, Georgia, serif" },
  { label: "Courier New", value: "'Courier New', Courier, monospace" },
  { label: "Consolas", value: "Consolas, 'Courier New', monospace" },
  { label: "Impact", value: "Impact, Haettenschweiler, sans-serif" },
];

export const FONT_WEIGHTS = [
  { label: "Light", value: 300 },
  { label: "Normal", value: 400 },
  { label: "Medium", value: 500 },
  { label: "Semi Bold", value: 600 },
  { label: "Bold", value: 700 },
  { label: "Extra Bold", value: 800 },
  { label: "Black", value: 900 },
];

export const DEFAULT_STYLE: FieldStyle = {
  fontFamily: "'Card Sans', Arial, sans-serif",
  fontSize: 8,
  fontWeight: 600,
  fontStyle: "normal",
  color: "#111827",
  align: "left",
  verticalAlign: "middle",
  letterSpacing: 0,
  lineHeight: 1.2,
  textTransform: "none",
  opacity: 1,
  backgroundColor: "transparent",
  borderColor: "transparent",
  borderWidth: 0,
  cornerRadius: 0,
  imageFit: "cover",
};
