import React from "react";
import { LayoutGrid, List } from "lucide-react";
import { ensureBlockRects, isCanvasLayoutMode, migrateFlowBlocksToCanvas } from "./kpCanvasLayout";
import { ensurePdfBlocks } from "./kpPdfBlocks";
import type { KpDocumentLayoutMode, KpTemplateConfig } from "./types";

export function KpLayoutModeSwitch({
  draft,
  onChange,
  dense = false,
}: {
  draft: KpTemplateConfig;
  onChange: (next: KpTemplateConfig) => void;
  dense?: boolean;
}) {
  const mode: KpDocumentLayoutMode = isCanvasLayoutMode(draft) ? "canvas" : "flow";

  function setMode(next: KpDocumentLayoutMode) {
    if (next === mode) return;
    let pdfBlocks = ensurePdfBlocks(draft);
    if (next === "canvas") {
      pdfBlocks = migrateFlowBlocksToCanvas(pdfBlocks, draft);
      pdfBlocks = ensureBlockRects(pdfBlocks, draft);
    }
    onChange({
      ...draft,
      pdfBlocks,
      pdfDesign: { ...(draft.pdfDesign || {}), layoutMode: next },
    });
  }

  return (
    <div className={dense ? "" : "rounded-card border border-border bg-rowHover p-3"}>
      {!dense ? <div className="text-sm font-semibold mb-1">Режим конструктора</div> : null}
      {!dense ? (
        <p className="text-[11px] text-text2 mb-3 leading-relaxed">
          <strong className="text-white/85">Список</strong> — классический порядок.{" "}
          <strong className="text-white/85">Холст Figma</strong> — блоки на листе.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setMode("flow")}
          className={`flex items-center gap-2 rounded-card border px-4 py-2 text-sm ${
            mode === "flow" ? "border-primary bg-primary/15 font-semibold" : "border-border bg-white"
          }`}
        >
          <List size={16} />
          Список
        </button>
        <button
          type="button"
          onClick={() => setMode("canvas")}
          className={`flex items-center gap-2 rounded-card border px-4 py-2 text-sm ${
            mode === "canvas" ? "border-primary bg-primary/15 font-semibold" : "border-border bg-white"
          }`}
        >
          <LayoutGrid size={16} />
          Холст Figma
        </button>
      </div>
    </div>
  );
}
