"use client";

import { useEffect, useState } from "react";

/** Expands #abc to #aabbcc and lower-cases, or returns null when incomplete. */
function normaliseHex(input: string): string | null {
  const text = input.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(text)) {
    const [r, g, b] = text.split("");
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  if (/^[0-9a-fA-F]{6}$/.test(text)) return `#${text}`.toLowerCase();
  return null;
}

/**
 * A colour swatch plus a hex box.
 *
 * The hex box keeps its own draft text, so half-typed values like "#ff" never
 * reach the card. Without that, every keystroke was pushed straight through
 * and the colour jumped around while you typed.
 */
export default function ColourField({
  label,
  value,
  onChange,
  allowNone = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  allowNone?: boolean;
}) {
  const isNone = value === "transparent" || !value;
  const committed = isNone ? "#000000" : (normaliseHex(value) ?? value);
  const [draft, setDraft] = useState(isNone ? "" : committed);

  // Follow changes made elsewhere, but never fight what is being typed.
  useEffect(() => {
    setDraft(isNone ? "" : committed);
  }, [committed, isNone]);

  function commitDraft(text: string) {
    const hex = normaliseHex(text);
    if (hex) onChange(hex);
    else setDraft(isNone ? "" : committed);
  }

  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <div className="flex items-center gap-1.5">
        <input
          type="color"
          aria-label={`${label} picker`}
          className="h-9 w-10 shrink-0 cursor-pointer rounded border border-slate-300 bg-white p-1"
          value={committed}
          onChange={(e) => onChange(e.target.value.toLowerCase())}
        />
        <input
          className="input min-w-0 flex-1 px-2 py-1.5 font-mono text-xs uppercase"
          value={draft}
          placeholder={isNone ? "none" : "#000000"}
          spellCheck={false}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => commitDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") setDraft(isNone ? "" : committed);
          }}
        />
        {allowNone ? (
          <button
            type="button"
            className="btn-secondary shrink-0 px-2 py-1.5 text-[11px]"
            onClick={() => onChange("transparent")}
            title="No colour"
          >
            None
          </button>
        ) : null}
      </div>
    </label>
  );
}
