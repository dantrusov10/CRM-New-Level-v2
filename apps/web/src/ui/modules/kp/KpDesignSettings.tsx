import React from "react";
import { Input } from "../../components/Input";
import { KpColorPicker } from "./KpColorPicker";
import { KpFontSelect } from "./KpFontSelect";
import { isCanvasLayoutMode } from "./kpCanvasLayout";
import {
  FONT_OPTIONS,
  LAYOUT_OPTIONS,
  PAPER_OPTIONS,
  TABLE_OPTIONS,
  applyDesignPreset,
  normalizePdfDesign,
} from "./kpDesign";
import type { KpPdfDesign, KpTemplateConfig } from "./types";

export function KpDesignSettings({
  draft,
  onChange,
}: {
  draft: KpTemplateConfig;
  onChange: (next: KpTemplateConfig) => void;
}) {
  const design = normalizePdfDesign(draft);
  const accent = draft.branding?.primaryColor || "#004EEB";

  function patchDesign(patch: Partial<KpPdfDesign>) {
    onChange({
      ...draft,
      pdfDesign: { ...(draft.pdfDesign || {}), ...patch },
    });
  }

  function setPreset(id: "classic" | "modern" | "minimal") {
    onChange({
      ...draft,
      pdfDesign: { ...(draft.pdfDesign || {}), ...applyDesignPreset(id) },
    });
  }

  return (
    <div className="rounded-card border border-border bg-rowHover p-4 grid gap-4">
      <div>
        <div className="text-sm font-semibold">Оформление PDF</div>
        <p className="text-xs text-text2 mt-1">
          Выпадающий список: веб-шрифты + все базовые системные. Холст Figma — справа при переключении режима.
        </p>
      </div>

      <div>
        <div className="text-xs text-text2 mb-2">Быстрый стиль</div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: "classic" as const, label: "Классика" },
              { id: "modern" as const, label: "Современный" },
              { id: "minimal" as const, label: "Лаконичный" },
            ] as const
          ).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPreset(p.id)}
              className={`rounded-card border px-3 py-1.5 text-xs ${
                design.layoutStyle === p.id || (p.id === "minimal" && design.layoutStyle === "compact")
                  ? "border-primary bg-primary/10"
                  : "border-border bg-white"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <KpFontSelect
        value={design.fontFamily}
        onChange={(id) => patchDesign({ fontFamily: id as typeof design.fontFamily })}
      />

      {isCanvasLayoutMode(draft) ? (
        <div>
          <div className="text-xs text-text2 mb-2">Фон листа (картинка)</div>
          <label className="flex flex-col gap-2 cursor-pointer rounded-card border border-dashed border-border bg-white p-3 text-xs text-[#374151] hover:border-primary">
            PNG/JPG/WebP до 3 МБ
            <input
              type="file"
              className="sr-only"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (f.size > 3 * 1024 * 1024) {
                  return;
                }
                const reader = new FileReader();
                reader.onload = () => patchDesign({ pageBackgroundUrl: String(reader.result || "") });
                reader.readAsDataURL(f);
                e.target.value = "";
              }}
            />
          </label>
          {design.pageBackgroundUrl ? (
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <img src={design.pageBackgroundUrl} alt="" className="h-12 max-w-[160px] object-cover rounded border" />
              <button
                type="button"
                className="text-[10px] text-danger underline"
                onClick={() => patchDesign({ pageBackgroundUrl: "" })}
              >
                Убрать фон
              </button>
              <div className="flex items-center gap-2 text-xs text-text2">
                Прозрачность
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round((design.pageBackgroundOpacity ?? 1) * 100)}
                  onChange={(e) => patchDesign({ pageBackgroundOpacity: Number(e.target.value) / 100 })}
                />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <div className="text-xs text-text2 mb-1">Базовый размер, pt</div>
          <Input
            type="number"
            value={String(design.bodyFontSizePt)}
            onChange={(e) => patchDesign({ bodyFontSizePt: Number(e.target.value || 11) })}
          />
        </div>
        <div>
          <div className="text-xs text-text2 mb-1">Заголовок, pt</div>
          <Input
            type="number"
            value={String(design.headingFontSizePt)}
            onChange={(e) => patchDesign({ headingFontSizePt: Number(e.target.value || 16) })}
          />
        </div>
        <div>
          <div className="text-xs text-text2 mb-1">Межстрочный</div>
          <Input
            type="number"
            step="0.05"
            value={String(design.lineHeight)}
            onChange={(e) => patchDesign({ lineHeight: Number(e.target.value || 1.45) })}
          />
        </div>
        <div>
          <div className="text-xs text-text2 mb-1">Поля листа, мм</div>
          <Input
            type="number"
            value={String(design.pageMarginMm)}
            onChange={(e) => patchDesign({ pageMarginMm: Number(e.target.value || 12) })}
          />
        </div>
        <div>
          <div className="text-xs text-text2 mb-1">Межбуквенный, px</div>
          <Input
            type="number"
            step="0.5"
            value={String(design.letterSpacingPx)}
            onChange={(e) => patchDesign({ letterSpacingPx: Number(e.target.value || 0) })}
          />
        </div>
      </div>

      {design.layoutMode === "canvas" ? (
        <div className="rounded-card border border-primary/30 bg-primary/5 p-3 grid gap-3">
          <div className="text-xs font-semibold">Холст Figma</div>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={design.canvasShowGrid}
              onChange={(e) => patchDesign({ canvasShowGrid: e.target.checked })}
            />
            Показывать сетку
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={design.canvasSnap}
              onChange={(e) => patchDesign({ canvasSnap: e.target.checked })}
            />
            Привязка к сетке
          </label>
          <div>
            <div className="text-xs text-text2 mb-1">Шаг сетки, px</div>
            <Input
              type="number"
              className="max-w-[100px]"
              value={String(design.canvasGridPx)}
              onChange={(e) => patchDesign({ canvasGridPx: Number(e.target.value || 8) })}
            />
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <KpColorPicker
          label="Цвет текста"
          value={design.textColor || "#111827"}
          onChange={(c) => patchDesign({ textColor: c })}
        />
        <KpColorPicker
          label="Вторичный"
          value={design.secondaryColor || "#6b7280"}
          onChange={(c) => patchDesign({ secondaryColor: c })}
        />
        <KpColorPicker
          label="Фон шапки таблицы"
          value={design.tableHeaderBg || "#EEF1F6"}
          onChange={(c) => patchDesign({ tableHeaderBg: c, tableHeaderUseAccent: false })}
        />
      </div>

      <div>
        <div className="text-xs text-text2 mb-2">Макет страницы</div>
        <div className="grid gap-2 sm:grid-cols-3">
          {LAYOUT_OPTIONS.map((o) => (
            <label
              key={o.id}
              className={`flex items-start gap-2 rounded-card border p-2 cursor-pointer ${
                design.layoutStyle === o.id ? "border-primary bg-white" : "border-border bg-white/50"
              }`}
            >
              <input
                type="radio"
                name="layoutStyle"
                className="mt-1"
                checked={design.layoutStyle === o.id}
                onChange={() => patchDesign({ layoutStyle: o.id })}
              />
              <span>
                <span className="text-xs font-semibold">{o.label}</span>
                <span className="block text-[10px] text-text2">{o.desc}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-xs text-text2 mb-2">Масштаб (пресет)</div>
          <div className="flex flex-wrap gap-1">
            {FONT_OPTIONS.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => patchDesign({ fontScale: o.id })}
                className={`rounded-card border px-2 py-1 text-xs ${
                  design.fontScale === o.id ? "border-primary bg-primary/10" : "border-border bg-white"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-xs text-text2 mb-2">Таблица</div>
          <div className="flex flex-wrap gap-1">
            {TABLE_OPTIONS.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => patchDesign({ tableStyle: o.id })}
                className={`rounded-card border px-2 py-1 text-xs ${
                  design.tableStyle === o.id ? "border-primary bg-primary/10" : "border-border bg-white"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <div className="text-xs text-text2 mb-2">Фон листа</div>
        <div className="flex flex-wrap gap-2">
          {PAPER_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => patchDesign({ paperTone: o.id, paperBg: o.bg })}
              className={`flex items-center gap-2 rounded-card border px-3 py-1.5 text-xs ${
                design.paperTone === o.id ? "border-primary bg-primary/10" : "border-border bg-white"
              }`}
            >
              <span className="h-4 w-4 rounded border border-black/10" style={{ background: o.bg }} />
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="text-xs text-text2 mb-2">Шапка таблицы</div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => patchDesign({ tableHeaderUseAccent: false })}
            className={`rounded-card border px-3 py-1.5 text-xs ${
              !design.tableHeaderUseAccent ? "border-primary bg-primary/10" : "border-border bg-white"
            }`}
          >
            Серая
          </button>
          <button
            type="button"
            onClick={() => patchDesign({ tableHeaderUseAccent: true })}
            className={`rounded-card border px-3 py-1.5 text-xs ${
              design.tableHeaderUseAccent ? "border-primary bg-primary/10" : "border-border bg-white"
            }`}
          >
            В цвет акцента
          </button>
        </div>
      </div>

      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={design.showValidityLine}
          onChange={(e) => patchDesign({ showValidityLine: e.target.checked })}
        />
        Строка «Срок действия» в шапке
      </label>
      {design.showValidityLine ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-text2">Дней:</span>
          <Input
            type="number"
            className="max-w-[80px]"
            value={String(design.validityDays)}
            onChange={(e) => patchDesign({ validityDays: Number(e.target.value || 10) })}
          />
        </div>
      ) : null}

      <div>
        <div className="text-xs text-text2 mb-1">Название таблицы в PDF</div>
        <Input
          value={draft?.specification?.title || "Спецификация"}
          onChange={(e) =>
            onChange({
              ...draft,
              specification: { ...(draft.specification || {}), title: e.target.value },
            })
          }
        />
      </div>

      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={draft?.specification?.showVatColumn !== false}
          onChange={(e) =>
            onChange({
              ...draft,
              specification: { ...(draft.specification || {}), showVatColumn: e.target.checked },
            })
          }
        />
        Показывать пометку НДС под таблицей
      </label>

      <div className="text-[10px] text-text2 rounded-card bg-[rgba(0,78,235,0.08)] px-2 py-1.5">
        Акцент: <span style={{ color: accent }}>{accent}</span> — в блоке «Фирменный стиль».
      </div>
    </div>
  );
}
