import React from "react";
import { Download, Upload } from "lucide-react";
import { Button } from "../../components/Button";
import type { KpTemplateConfig } from "./types";
import { ensurePdfBlocks } from "./kpPdfBlocks";

export function KpTemplateImportExport({
  draft,
  onImport,
}: {
  draft: KpTemplateConfig;
  onImport: (json: KpTemplateConfig) => void;
}) {
  const fileRef = React.useRef<HTMLInputElement | null>(null);

  function exportJson() {
    const payload = {
      ...draft,
      pdfBlocks: ensurePdfBlocks(draft),
      exportedAt: new Date().toISOString(),
      exportVersion: 2,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(draft.name || "kp-template").replace(/[^\wа-яА-ЯёЁ\-]+/gi, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || "{}")) as KpTemplateConfig;
        if (!parsed || typeof parsed !== "object") throw new Error("Пустой файл");
        onImport(parsed);
      } catch {
        window.alert("Не удалось прочитать шаблон. Нужен файл .json, экспортированный из этой CRM.");
      }
      e.target.value = "";
    };
    reader.readAsText(f, "utf-8");
  }

  return (
    <div className="rounded-card border border-border bg-rowHover p-3 flex flex-wrap items-center justify-between gap-3">
      <div>
        <div className="text-sm font-semibold">Шаблон как файл</div>
        <p className="text-[11px] text-text2 mt-0.5 max-w-md">
          Скачайте настройки в JSON или загрузите готовый шаблон КП/ТКП (оформление, разделы, разрывы страниц).
          Word/PDF напрямую пока не поддерживаются — используйте JSON между средами.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button small variant="secondary" onClick={exportJson}>
          <Download size={14} className="mr-1" />
          Скачать .json
        </Button>
        <Button small variant="secondary" onClick={() => fileRef.current?.click()}>
          <Upload size={14} className="mr-1" />
          Загрузить .json
        </Button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={onFile} />
      </div>
    </div>
  );
}
