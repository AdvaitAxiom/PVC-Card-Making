"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import CardCanvas from "./CardCanvas";
import { CardTemplate } from "@/lib/types";
import { listTemplates } from "@/lib/db";

export default function TemplatePicker({
  open,
  onClose,
  onPick,
  title = "Choose a card template",
}: {
  open: boolean;
  onClose: () => void;
  onPick: (template: CardTemplate) => void;
  title?: string;
}) {
  const [templates, setTemplates] = useState<CardTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    listTemplates()
      .then(setTemplates)
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <button onClick={onClose} className="btn-ghost p-2" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto p-5">
          {loading ? (
            <p className="py-10 text-center text-sm text-slate-500">Loading templates…</p>
          ) : templates.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">
              No templates yet. Add one from the Templates page.
            </p>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => onPick(template)}
                  className="group flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-brand-400 hover:bg-brand-50/50 hover:shadow-md"
                >
                  <CardCanvas
                    template={template}
                    card={null}
                    side="front"
                    pxPerMm={2.7}
                    showPlaceholders
                    hiddenOutlines
                    idPrefix={`pick-${template.id}`}
                  />
                  <div className="w-full">
                    <p className="text-sm font-bold text-slate-900">{template.name}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{template.category}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
