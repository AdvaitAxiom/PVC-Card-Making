import {
  DEFAULT_STYLE,
  FieldLayout,
  FieldStyle,
  FieldType,
  Side,
  TemplateField,
} from "./types";

export function uid(prefix = "id"): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 10)
      : Math.random().toString(36).slice(2, 12);
  return `${prefix}_${rand}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function slugKey(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "field"
  );
}

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function makeField(options: {
  label: string;
  key: string;
  side: Side;
  type?: FieldType;
  layout: FieldLayout;
  style?: Partial<FieldStyle>;
  defaultValue?: string;
  placeholder?: string;
  multiline?: boolean;
  required?: boolean;
  helpText?: string;
}): TemplateField {
  return {
    id: uid("fld"),
    key: options.key,
    label: options.label,
    type: options.type ?? "text",
    side: options.side,
    required: options.required ?? false,
    multiline: options.multiline ?? false,
    placeholder: options.placeholder ?? "",
    defaultValue: options.defaultValue ?? "",
    helpText: options.helpText ?? "",
    layout: options.layout,
    style: { ...DEFAULT_STYLE, ...(options.style ?? {}) },
    locked: false,
  };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
