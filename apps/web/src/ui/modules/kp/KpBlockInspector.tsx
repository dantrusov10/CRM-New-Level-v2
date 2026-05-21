import React from "react";
import { Input } from "../../components/Input";
import { KpColorPicker } from "./KpColorPicker";
import { KpRichTextEditor } from "./KpRichTextEditor";
import { KpFontSelect } from "./KpFontSelect";
import { KP_PDF_BLOCK_META } from "./kpPdfBlocks";
import type { KpFontFamilyId, KpPdfBlock, KpTemplateConfig } from "./types";

export function KpBlockInspector({
  block,
  template,
  onPatch,
  pageCount,
}: {
  block: KpPdfBlock | null;
  template: KpTemplateConfig;
  onPatch: (id: string, patch: Partial<KpPdfBlock>) => void;
  pageCount: number;
}) {
  if (!block) {
    return (
      <div className="rounded-card border border-border bg-rowHover p-3 text-[11px] text-text2">
        Выберите блок на холсте — здесь появятся его координаты и стили.
      </div>
    );
  }

  const b = block;
  const meta = KP_PDF_BLOCK_META[b.type];
  const rect = b.rect || { x: 0, y: 0, w: 100, h: 80, pageIndex: 0, zIndex: 1 };
  const style = b.style || {};

  function patchRect(patch: Partial<typeof rect>) {
    onPatch(b.id, { rect: { ...rect, ...patch } });
  }
  function patchStyle(patch: Partial<typeof style>) {
    onPatch(b.id, { style: { ...style, ...patch } });
  }

  return (
    <div className="rounded-card border border-primary/40 bg-white p-3 grid gap-3 text-[#111]">
      <div>
        <div className="text-xs font-semibold text-[#111]">{meta.label}</div>
        <div className="text-[10px] text-[#6b7280]">{meta.hint}</div>
      </div>

      <label className="flex items-center gap-2 text-xs text-[#374151]">
        <input
          type="checkbox"
          checked={b.enabled}
          disabled={b.type === "specification_table"}
          onChange={(e) => onPatch(b.id, { enabled: e.target.checked })}
        />
        Показывать в PDF
      </label>

      {b.type === "custom" ? (
        <>
          <Input
            value={b.title || ""}
            onChange={(e) => onPatch(b.id, { title: e.target.value })}
            placeholder="Заголовок"
          />
          <KpRichTextEditor
            value={b.bodyHtml || ""}
            onChange={(html) => onPatch(b.id, { bodyHtml: html })}
            minHeight={80}
          />
        </>
      ) : null}

      <div className="text-[10px] font-semibold text-[#6b7280] uppercase tracking-wide">Позиция на листе</div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-[10px] mb-0.5">X</div>
          <Input type="number" value={String(rect.x)} onChange={(e) => patchRect({ x: Number(e.target.value) })} />
        </div>
        <div>
          <div className="text-[10px] mb-0.5">Y</div>
          <Input type="number" value={String(rect.y)} onChange={(e) => patchRect({ y: Number(e.target.value) })} />
        </div>
        <div>
          <div className="text-[10px] mb-0.5">Ширина</div>
          <Input type="number" value={String(rect.w)} onChange={(e) => patchRect({ w: Number(e.target.value) })} />
        </div>
        <div>
          <div className="text-[10px] mb-0.5">Высота</div>
          <Input
            type="number"
            value={String(rect.h ?? "")}
            onChange={(e) => patchRect({ h: Number(e.target.value) || undefined })}
          />
        </div>
        <div>
          <div className="text-[10px] mb-0.5">Страница</div>
          <Input
            type="number"
            min={0}
            max={Math.max(0, pageCount - 1)}
            value={String(rect.pageIndex ?? 0)}
            onChange={(e) => patchRect({ pageIndex: Math.max(0, Number(e.target.value)) })}
          />
        </div>
        <div>
          <div className="text-[10px] mb-0.5">Слой (z)</div>
          <Input type="number" value={String(rect.zIndex ?? 1)} onChange={(e) => patchRect({ zIndex: Number(e.target.value) })} />
        </div>
        <div>
          <div className="text-[10px] mb-0.5">Поворот, °</div>
          <Input
            type="number"
            value={String(rect.rotateDeg ?? 0)}
            onChange={(e) => patchRect({ rotateDeg: Number(e.target.value) })}
          />
        </div>
      </div>

      <div className="text-[10px] font-semibold text-[#6b7280] uppercase tracking-wide">Стили блока</div>
      <KpFontSelect
        label="Шрифт блока"
        allowEmpty
        emptyLabel="Как в документе"
        value={style.fontFamily || ""}
        onChange={(id) => patchStyle({ fontFamily: (id || undefined) as KpFontFamilyId | undefined })}
      />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-[10px] mb-0.5">Размер, pt</div>
          <Input
            type="number"
            value={String(style.fontSizePt ?? "")}
            onChange={(e) => patchStyle({ fontSizePt: Number(e.target.value) || undefined })}
          />
        </div>
        <div>
          <div className="text-[10px] mb-0.5">Отступ, px</div>
          <Input
            type="number"
            value={String(style.paddingPx ?? "")}
            onChange={(e) => patchStyle({ paddingPx: Number(e.target.value) || undefined })}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <KpColorPicker label="Текст" value={style.textColor || "#111827"} onChange={(c) => patchStyle({ textColor: c })} />
        <KpColorPicker label="Фон" value={style.bgColor || "#ffffff"} onChange={(c) => patchStyle({ bgColor: c })} />
      </div>
      <div>
        <div className="text-[10px] mb-1">Выравнивание</div>
        <div className="flex gap-1">
          {(["left", "center", "right"] as const).map((a) => (
            <button
              key={a}
              type="button"
              className={`rounded-card border px-2 py-1 text-xs ${
                (style.textAlign || "left") === a ? "border-primary bg-primary/10" : "border-border"
              }`}
              onClick={() => patchStyle({ textAlign: a })}
            >
              {a === "left" ? "←" : a === "center" ? "↔" : "→"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
