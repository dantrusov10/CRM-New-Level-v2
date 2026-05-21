import React from "react";
import { ArrowDown, ArrowUp, Check, Circle, FilePlus, Trash2 } from "lucide-react";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import type { KpDocumentType, KpPdfBlock, KpTemplateConfig } from "./types";
import { countTemplatePages } from "./kpCanvasPages";
import { isCanvasLayoutMode } from "./kpCanvasLayout";
import { KpRichTextEditor } from "./KpRichTextEditor";
import { KP_PDF_BLOCK_META, applyPdfBlockPresetForDoc, createCustomBlock } from "./kpPdfBlocks";

const PRESETS: { id: "standard" | "minimal" | "full"; label: string; desc: string }[] = [
  { id: "standard", label: "Стандарт", desc: "Шапка, клиент, таблица, итоги, подпись" },
  { id: "minimal", label: "Краткое", desc: "Только суть: шапка, таблица, итоги" },
  { id: "full", label: "Полное", desc: "Все разделы, включая условия оплаты" },
];

function blockLabel(b: KpPdfBlock) {
  if (b.type === "custom") return b.title || "Свой раздел";
  return KP_PDF_BLOCK_META[b.type].label;
}

export function KpDocumentSectionsEditor({
  blocks,
  onChange,
  documentType = "kp",
  template,
  variant = "full",
}: {
  blocks: KpPdfBlock[];
  onChange: (next: KpPdfBlock[]) => void;
  documentType?: KpDocumentType;
  template?: KpTemplateConfig;
  /** compact — боковая колонка на холсте (одна линия с слоями и листом) */
  variant?: "full" | "compact";
}) {
  function patchBlock(id: string, patch: Partial<KpPdfBlock>) {
    onChange(blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  function toggleBlock(id: string, enabled: boolean) {
    patchBlock(id, { enabled });
  }

  function moveBlock(id: string, dir: -1 | 1) {
    const idx = blocks.findIndex((b) => b.id === id);
    if (idx < 0) return;
    const next = idx + dir;
    if (next < 0 || next >= blocks.length) return;
    const copy = [...blocks];
    const [item] = copy.splice(idx, 1);
    copy.splice(next, 0, item);
    onChange(copy);
  }

  function removeBlock(id: string) {
    const b = blocks.find((x) => x.id === id);
    if (!b || b.type !== "custom") return;
    onChange(blocks.filter((x) => x.id !== id));
  }

  function addCustom() {
    onChange([...blocks, createCustomBlock()]);
  }

  function applyPreset(preset: "standard" | "minimal" | "full") {
    onChange(applyPdfBlockPresetForDoc(preset, documentType));
  }

  const enabledBlocks = blocks.filter((b) => b.enabled);
  const canvasMode = template ? isCanvasLayoutMode(template) : false;
  const pageCount = template ? countTemplatePages({ ...template, pdfBlocks: blocks }) : 1;
  const compact = variant === "compact";

  return (
    <div
      className={`rounded-card border border-border ${compact ? "bg-[#2a2f38] p-2" : "bg-rowHover p-4"}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className={`font-semibold ${compact ? "text-xs text-white" : "text-sm"}`}>Разделы</div>
        <Button small variant="secondary" onClick={addCustom}>
          <FilePlus size={14} className="mr-1" />
          {compact ? "+" : "Свой раздел"}
        </Button>
      </div>
      {!compact ? (
        <p className="text-xs text-text2 mt-1 leading-relaxed max-w-lg">
          {canvasMode
            ? "Включение разделов. Позиции — на холсте."
            : "Порядок = порядок в PDF. «Новый лист» — разрыв. Свои разделы — TipTap."}
        </p>
      ) : null}

      {!compact ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => applyPreset(p.id)}
              className="rounded-card border border-border bg-white px-3 py-2 text-left hover:border-primary transition-colors"
            >
              <div className="text-xs font-semibold">{p.label}</div>
              <div className="text-[10px] text-text2">{p.desc}</div>
            </button>
          ))}
        </div>
      ) : null}

      <div className={`${compact ? "mt-2" : "mt-4"} grid gap-2`}>
        {blocks.map((b, index) => {
          const meta = KP_PDF_BLOCK_META[b.type];
          const isRequired = b.type === "specification_table";
          const isCustom = b.type === "custom";
          const tkpHint = b.type === "technical" && documentType === "tkp";

          return (
            <div
              key={b.id}
              className={`rounded-card border transition-colors ${
                compact ? "p-2" : "p-3"
              } ${
                b.enabled
                  ? compact
                    ? "border-primary/50 bg-[rgba(255,255,255,0.06)]"
                    : "border-primary/40 bg-white"
                  : "border-border bg-[rgba(255,255,255,0.03)] opacity-75"
              }`}
            >
              <div className="flex gap-2">
                <div className="flex flex-col items-center gap-0.5 shrink-0 pt-0.5">
                  <span className="text-[10px] font-bold text-text2 w-5 text-center">{index + 1}</span>
                  <Button small variant="secondary" onClick={() => moveBlock(b.id, -1)} disabled={index === 0}>
                    <ArrowUp size={12} />
                  </Button>
                  <Button
                    small
                    variant="secondary"
                    onClick={() => moveBlock(b.id, 1)}
                    disabled={index === blocks.length - 1}
                  >
                    <ArrowDown size={12} />
                  </Button>
                </div>

                <div className="flex-1 min-w-0 grid gap-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold">{isCustom ? b.title || meta.label : meta.label}</div>
                      <div className="text-[11px] text-text2">{meta.hint}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <label className="flex items-center gap-1.5 text-[10px] text-text2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!b.pageBreakBefore}
                          disabled={index === 0 || canvasMode}
                          onChange={(e) => patchBlock(b.id, { pageBreakBefore: e.target.checked })}
                        />
                        {canvasMode ? "Лист (холст)" : "Новый лист"}
                      </label>
                      {isCustom ? (
                        <Button small variant="secondary" onClick={() => removeBlock(b.id)} title="Удалить раздел">
                          <Trash2 size={14} className="text-danger" />
                        </Button>
                      ) : null}
                      <label className="flex flex-col items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={b.enabled}
                          disabled={isRequired}
                          onChange={(e) => toggleBlock(b.id, e.target.checked)}
                        />
                        <span
                          className={`flex h-8 w-8 items-center justify-center rounded-full border ${
                            b.enabled ? "bg-primary border-primary text-white" : "border-border text-text2"
                          }`}
                        >
                          {b.enabled ? <Check size={16} /> : <Circle size={14} />}
                        </span>
                      </label>
                    </div>
                  </div>

                  {isCustom && b.enabled ? (
                    <div className="grid gap-2 pl-0 border-t border-border pt-2">
                      <Input
                        value={b.title || ""}
                        onChange={(e) => patchBlock(b.id, { title: e.target.value })}
                        placeholder="Заголовок раздела"
                      />
                      <KpRichTextEditor
                        value={b.bodyHtml || ""}
                        onChange={(html) => patchBlock(b.id, { bodyHtml: html })}
                        placeholder="Текст раздела: списки, таблицы, форматирование…"
                      />
                    </div>
                  ) : null}

                  {isRequired ? <div className="text-[10px] text-primary">Обязательный раздел</div> : null}
                  {tkpHint ? <div className="text-[10px] text-primary">Рекомендуется для ТКП</div> : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 rounded-card bg-[rgba(0,78,235,0.08)] border border-primary/20 px-3 py-2 text-[11px] text-text2 space-y-1">
        <div>
          <strong className="text-white/90">Порядок:</strong>{" "}
          {enabledBlocks.length ? enabledBlocks.map((b) => blockLabel(b)).join(" → ") : "—"}
        </div>
        <div>
          <strong className="text-white/90">Листов в PDF:</strong> {Math.max(1, pageCount)}
        </div>
      </div>
    </div>
  );
}
