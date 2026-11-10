"use client";

import { useState } from "react";
import { TEMPLATE_IMAGES } from "@/lib/template-images";
import { readFileAsDataUrl } from "@/lib/utils";

export default function TemplateImagePalette({
  onInsert,
  onError,
}: {
  onInsert: (label: string, dataUrl: string) => void;
  onError: (message: string) => void;
}) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function insertImage(image: (typeof TEMPLATE_IMAGES)[number]) {
    setLoadingId(image.id);
    try {
      const response = await fetch(image.src);
      if (!response.ok) throw new Error(`Image request failed (${response.status}).`);
      const blob = await response.blob();
      const dataUrl = await readFileAsDataUrl(
        new File([blob], `${image.id}.jpeg`, { type: "image/jpeg" }),
      );
      onInsert(image.label, dataUrl);
    } catch {
      onError(`Could not add ${image.label}. Please try again.`);
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <section className="border-b border-slate-200 p-3" aria-label="Vehicle images">
      <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
        Vehicle images
      </h3>
      <p className="mb-2 mt-1 text-[11px] text-slate-500">
        Click to add, then move, resize or adjust it in Properties.
      </p>
      <div className="grid grid-cols-2 gap-2" aria-busy={loadingId !== null}>
        {TEMPLATE_IMAGES.map((image) => (
          <button
            key={image.id}
            type="button"
            className="rounded-lg border border-slate-200 bg-white p-1.5 text-left transition hover:border-brand-400 hover:bg-brand-50 focus-visible:outline-brand-600 disabled:opacity-50"
            title={`Add ${image.label}`}
            aria-label={`Add ${image.label}`}
            disabled={loadingId !== null}
            onClick={() => void insertImage(image)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.src} alt="" width={512} height={512} className="h-16 w-full rounded object-contain" />
            <span className="mt-1 block text-[10px] font-semibold text-slate-600">
              {loadingId === image.id ? "Adding..." : image.label}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
