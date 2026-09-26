"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Copy,
  FilePlus2,
  Pencil,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import CardCanvas from "@/components/CardCanvas";
import { useConfirm } from "@/components/ConfirmDialog";
import { CardTemplate, CR80 } from "@/lib/types";
import {
  deleteTemplate,
  duplicateTemplate,
  ensureSeeded,
  listTemplates,
  restoreBuiltInTemplates,
  saveTemplate,
} from "@/lib/db";
import { BLANK_BACK_SVG, BLANK_FRONT_SVG } from "@/lib/seed-templates";
import { formatDate, uid } from "@/lib/utils";

export default function TemplatesPage() {
  const router = useRouter();
  const confirm = useConfirm();
  const [templates, setTemplates] = useState<CardTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setTemplates(await listTemplates());
  }

  useEffect(() => {
    ensureSeeded()
      .then(refresh)
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate() {
    const template: CardTemplate = {
      id: uid("tpl"),
      name: "New template",
      category: "Custom",
      description: "",
      widthMm: CR80.widthMm,
      heightMm: CR80.heightMm,
      cornerRadiusMm: CR80.cornerRadiusMm,
      frontSvg: BLANK_FRONT_SVG,
      backSvg: BLANK_BACK_SVG,
      fields: [],
      builtIn: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await saveTemplate(template);
    router.push(`/templates/${template.id}`);
  }

  async function handleDuplicate(id: string) {
    await duplicateTemplate(id);
    refresh();
  }

  async function handleDelete(template: CardTemplate) {
    const ok = await confirm({
      title: `Delete "${template.name}"?`,
      message:
        "Cards already made from this template will keep their data, but they will not open until the template is restored from a backup.",
      confirmLabel: "Delete template",
      tone: "danger",
    });
    if (!ok) return;
    await deleteTemplate(template.id);
    refresh();
  }

  async function handleRestore() {
    const ok = await confirm({
      title: "Reinstall built-in templates?",
      message:
        "The three sample licence templates will be put back as they were. Your own templates are not affected.",
      confirmLabel: "Reinstall",
    });
    if (!ok) return;
    await restoreBuiltInTemplates();
    refresh();
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-7">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Card templates</h1>
          <p className="mt-1 text-sm text-slate-500">
            Each template stores its front and back artwork separately as SVG, plus the list of
            details that go on the card. Use <strong>Save to app</strong> in a template to make
            it permanent.
          </p>
        </div>
        <div className="flex gap-2">
          {templates.some((t) => t.builtIn) ? (
            <button className="btn-secondary" onClick={handleRestore}>
              <RefreshCw size={16} />
              Restore built-ins
            </button>
          ) : null}
          <button className="btn-primary" onClick={handleCreate}>
            <FilePlus2 size={17} />
            New template
          </button>
        </div>
      </div>

      {loading ? (
        <p className="py-16 text-center text-sm text-slate-500">Loading templates…</p>
      ) : templates.length === 0 ? (
        <div className="card-panel flex flex-col items-center gap-4 px-6 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <FilePlus2 size={26} />
          </div>
          <div className="max-w-md">
            <h2 className="text-lg font-bold text-slate-900">No templates yet</h2>
            <p className="mt-1 text-sm text-slate-500">
              Create one, upload your front and back SVG artwork, then press{" "}
              <strong>Save to app</strong> to make it a permanent part of the app.
            </p>
          </div>
          <button className="btn-primary" onClick={handleCreate}>
            <FilePlus2 size={17} />
            Create your first template
          </button>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">
          {templates.map((template) => (
            <div key={template.id} className="card-panel overflow-hidden">
              <div className="flex flex-wrap items-center justify-center gap-4 bg-slate-100 p-4">
                <div className="text-center">
                  <CardCanvas
                    template={template}
                    card={null}
                    side="front"
                    pxPerMm={3}
                    showPlaceholders
                    hiddenOutlines
                    idPrefix={`tpl-f-${template.id}`}
                  />
                  <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Front
                  </p>
                </div>
                <div className="text-center">
                  <CardCanvas
                    template={template}
                    card={null}
                    side="back"
                    pxPerMm={3}
                    showPlaceholders
                    hiddenOutlines
                    idPrefix={`tpl-b-${template.id}`}
                  />
                  <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Back
                  </p>
                </div>
              </div>

              <div className="border-t border-slate-200 p-4">
                <div className="flex items-center gap-2">
                  <h2 className="truncate text-sm font-bold text-slate-900">{template.name}</h2>
                  {template.builtIn ? (
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-700">
                      <ShieldCheck size={11} />
                      Built-in
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  {template.category} · {template.fields.length} details ·{" "}
                  {formatDate(template.updatedAt)}
                </p>
                {template.description ? (
                  <p className="mt-2 line-clamp-2 text-xs text-slate-500">{template.description}</p>
                ) : null}

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Link
                    href={`/templates/${template.id}`}
                    className="btn-secondary px-2.5 py-1.5 text-xs"
                  >
                    <Pencil size={14} />
                    Edit template
                  </Link>
                  <button
                    onClick={() => handleDuplicate(template.id)}
                    className="btn-secondary px-2.5 py-1.5 text-xs"
                  >
                    <Copy size={14} />
                    Duplicate
                  </button>
                  <button
                    onClick={() => handleDelete(template)}
                    className="btn-danger ml-auto px-2.5 py-1.5 text-xs"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
