import React from "react";
import { ArrowDown, ArrowUp, Check, Circle } from "lucide-react";
import { Button } from "../../components/Button";
import type { KpPdfBlock } from "./kpPdfBlocks";
import { KP_PDF_BLOCK_META, applyPdfBlockPreset } from "./kpPdfBlocks";

const PRESETS: { id: "standard" | "minimal" | "full"; label: string; desc: string }[] = [
  { id: "standard", label: "Стандарт", desc: "Шапка, клиент, таблица, итоги, подпись" },
  { id: "minimal", label: "Краткое", desc: "Только суть: шапка, таблица, итоги" },
  { id: "full", label: "Полное", desc: "Все разделы, включая условия оплаты" },
];

export function KpDocumentSectionsEditor({
  blocks,
  onChange,
}: {
  blocks: KpPdfBlock[];
  onChange: (next: KpPdfBlock[]) => void;
}) {
  function toggleBlock(id: string, enabled: boolean) {
    onChange(blocks.map((b) => (b.id === id ? { ...b, enabled } : b)));
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

  function applyPreset(preset: "standard" | "minimal" | "full") {
    onChange(applyPdfBlockPreset(preset));
  }

  const enabledBlocks = blocks.filter((b) => b.enabled);

  return (
    <div className="rounded-card border border-border bg-rowHover p-4">
      <div className="text-sm font-semibold">Разделы в документе</div>
      <p className="text-xs text-text2 mt-1 leading-relaxed">
        Отметьте, что попадёт в PDF, и расположите разделы сверху вниз — так же они пойдут в файл для клиента.
        Изменения сразу видны в предпросмотре справа.
      </p>

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

      <div className="mt-4 grid gap-2">
        {blocks.map((b, index) => {
          const meta = KP_PDF_BLOCK_META[b.type];
          const isRequired = b.type === "specification_table";
          return (
            <div
              key={b.id}
              className={`flex gap-2 rounded-card border p-3 transition-colors ${
                b.enabled ? "border-primary/40 bg-white" : "border-border bg-[rgba(255,255,255,0.03)] opacity-75"
              }`}
            >
              <div className="flex flex-col items-center gap-0.5 shrink-0 pt-0.5">
                <span className="text-[10px] font-bold text-text2 w-5 text-center">{index + 1}</span>
                <Button
                  small
                  variant="secondary"
                  onClick={() => moveBlock(b.id, -1)}
                  disabled={index === 0}
                  title="Выше в документе"
                >
                  <ArrowUp size={12} />
                </Button>
                <Button
                  small
                  variant="secondary"
                  onClick={() => moveBlock(b.id, 1)}
                  disabled={index === blocks.length - 1}
                  title="Ниже в документе"
                >
                  <ArrowDown size={12} />
                </Button>
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold">{meta.label}</div>
                <div className="text-[11px] text-text2 mt-0.5">{meta.hint}</div>
                {isRequired ? (
                  <div className="text-[10px] text-primary mt-1">Обязательный раздел</div>
                ) : null}
              </div>

              <label className="flex flex-col items-center gap-1 shrink-0 cursor-pointer">
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
                <span className="text-[10px] text-text2">{b.enabled ? "В PDF" : "Скрыт"}</span>
              </label>
            </div>
          );
        })}
      </div>

      <div className="mt-3 rounded-card bg-[rgba(0,78,235,0.08)] border border-primary/20 px-3 py-2 text-[11px] text-text2">
        <strong className="text-white/90">Порядок в файле:</strong>{" "}
        {enabledBlocks.length
          ? enabledBlocks.map((b) => KP_PDF_BLOCK_META[b.type].label).join(" → ")
          : "включите хотя бы таблицу спецификации"}
      </div>
    </div>
  );
}
