"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Copy, LayoutTemplate, Pencil, Plus, Printer, Trash2 } from "lucide-react";
import CardCanvas from "@/components/CardCanvas";
import TemplatePicker from "@/components/TemplatePicker";
import { useConfirm } from "@/components/ConfirmDialog";
import { CardRecord, CardTemplate } from "@/lib/types";
import {
  createCardFromTemplate,
  deleteCard,
  ensureSeeded,
  listCards,
  listTemplates,
  saveCard,
} from "@/lib/db";
import { formatDate, uid } from "@/lib/utils";

export default function DashboardPage() {
  const router = useRouter();
  const confirm = useConfirm();
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [templates, setTemplates] = useState<Record<string, CardTemplate>>({});
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedForPrint, setSelectedForPrint] = useState<string[]>([]);

  function togglePrint(id: string) {
    setSelectedForPrint((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function refresh() {
    const [cardList, templateList] = await Promise.all([listCards(), listTemplates()]);
    setCards(cardList);
    setTemplates(Object.fromEntries(templateList.map((t) => [t.id, t])));
  }

  useEffect(() => {
    ensureSeeded()
      .then(refresh)
      .finally(() => setLoading(false));
  }, []);

  async function handlePick(template: CardTemplate) {
    const card = await createCardFromTemplate(template);
    router.push(`/cards/${card.id}`);
  }

  async function handleDuplicate(card: CardRecord) {
    const copy: CardRecord = {
      ...structuredClone(card),
      id: uid("card"),
      title: `${card.title} (copy)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await saveCard(copy);
    refresh();
  }

  async function handleDelete(card: CardRecord) {
    const ok = await confirm({
      title: "Delete this card?",
      message: `"${card.title}" will be removed from this browser. This cannot be undone.`,
      confirmLabel: "Delete card",
      tone: "danger",
    });
    if (!ok) return;
    await deleteCard(card.id);
    refresh();
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-7">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My cards</h1>
          <p className="mt-1 text-sm text-slate-500">
            Every card you create is saved in this browser. Start a new one from any template.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {selectedForPrint.length > 0 ? (
            <Link
              href={`/print/${selectedForPrint[0]}?ids=${selectedForPrint.join(",")}`}
              className="btn-secondary"
            >
              <Printer size={16} />
              Print {selectedForPrint.length} on one sheet
            </Link>
          ) : null}
          <button className="btn-primary" onClick={() => setPickerOpen(true)}>
            <Plus size={17} />
            New card
          </button>
        </div>
      </div>

      {loading ? (
        <p className="py-16 text-center text-sm text-slate-500">Loading your card library…</p>
      ) : cards.length === 0 ? (
        <div className="card-panel flex flex-col items-center gap-4 px-6 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <Plus size={26} />
          </div>
          {Object.keys(templates).length === 0 ? (
            <>
              <div className="max-w-md">
                <h2 className="text-lg font-bold text-slate-900">Add a template first</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Before you can make a card, upload the front and back artwork for the card
                  design you want to use.
                </p>
              </div>
              <Link href="/templates" className="btn-primary">
                <LayoutTemplate size={17} />
                Go to templates
              </Link>
            </>
          ) : (
            <>
              <div>
                <h2 className="text-lg font-bold text-slate-900">No cards yet</h2>
                <p className="mt-1 max-w-md text-sm text-slate-500">
                  Choose a template, fill in the details, drag them into position and print.
                </p>
              </div>
              <button className="btn-primary" onClick={() => setPickerOpen(true)}>
                <Plus size={17} />
                Create your first card
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {cards.map((card) => {
            const template = templates[card.templateId];
            return (
              <div key={card.id} className="card-panel overflow-hidden">
                <div className="flex items-center justify-center bg-slate-100 p-4">
                  {template ? (
                    <CardCanvas
                      template={template}
                      card={card}
                      side="front"
                      pxPerMm={2.9}
                      showPlaceholders={false}
                      hiddenOutlines
                      idPrefix={`thumb-${card.id}`}
                    />
                  ) : (
                    <p className="py-10 text-center text-xs text-red-600">
                      Template missing — it may have been deleted.
                    </p>
                  )}
                </div>
                <div className="border-t border-slate-200 p-4">
                  <label className="mb-2 flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-600">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-brand-600"
                      checked={selectedForPrint.includes(card.id)}
                      onChange={() => togglePrint(card.id)}
                    />
                    Add to sheet
                  </label>
                  <p className="truncate text-sm font-bold text-slate-900">{card.title}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {template?.name ?? "Unknown template"} · {formatDate(card.updatedAt)}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Link href={`/cards/${card.id}`} className="btn-secondary px-2.5 py-1.5 text-xs">
                      <Pencil size={14} />
                      Edit
                    </Link>
                    <Link href={`/print/${card.id}`} className="btn-secondary px-2.5 py-1.5 text-xs">
                      <Printer size={14} />
                      Print
                    </Link>
                    <button
                      onClick={() => handleDuplicate(card)}
                      className="btn-secondary px-2.5 py-1.5 text-xs"
                    >
                      <Copy size={14} />
                      Copy
                    </button>
                    <button
                      onClick={() => handleDelete(card)}
                      className="btn-danger ml-auto px-2.5 py-1.5 text-xs"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <TemplatePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={handlePick}
      />
    </div>
  );
}
