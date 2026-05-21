import React from "react";
import { LayoutTemplate } from "lucide-react";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { KP_TEMPLATE_PRESETS, applyTemplatePreset, type KpTemplatePreset } from "./kpTemplatePresets";
import type { KpTemplateConfig } from "./types";

export function KpTemplatePresetGallery({
  draft,
  onApply,
}: {
  draft: KpTemplateConfig;
  onApply: (next: KpTemplateConfig) => void;
}) {
  const docType = draft.documentType === "tkp" ? "tkp" : "kp";
  const presets = KP_TEMPLATE_PRESETS.filter((p) => p.documentType === docType);
  const [pending, setPending] = React.useState<KpTemplatePreset | null>(null);

  return (
    <>
      <div className="rounded-card border border-border bg-rowHover p-4">
        <div className="flex items-start gap-2">
          <LayoutTemplate size={18} className="text-primary shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold">Галерея готовых стилей</div>
            <p className="text-[11px] text-text2 mt-0.5 max-w-lg">
              Коллекция пресетов КП/ТКП: шрифты, цвета, разделы. После применения можно донастроить вручную.
            </p>
          </div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {presets.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPending(p)}
              className="rounded-card border border-border bg-white p-3 text-left hover:border-primary transition-colors"
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="h-3 w-3 rounded-full shrink-0 border border-black/10"
                  style={{ background: p.accentColor }}
                />
                <span className="text-xs font-semibold">{p.name}</span>
              </div>
              <div className="text-[10px] text-text2 leading-snug">{p.description}</div>
            </button>
          ))}
        </div>
      </div>

      <ConfirmDialog
        open={!!pending}
        title="Применить стиль?"
        message={
          pending ? (
            <>
              Применить стиль <strong className="text-white/90">«{pending.name}»</strong>? Текущие разделы и
              оформление будут заменены пресетом.
            </>
          ) : (
            ""
          )
        }
        confirmLabel="Применить"
        onConfirm={() => {
          if (pending) onApply(applyTemplatePreset(draft, pending));
          setPending(null);
        }}
        onCancel={() => setPending(null)}
      />
    </>
  );
}
