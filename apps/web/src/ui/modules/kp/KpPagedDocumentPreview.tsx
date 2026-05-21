import React from "react";
import { KpDocumentFrame } from "./KpDocumentFrame";
import { KpPreview } from "./KpPreview";
import { ensurePdfBlocks } from "./kpPdfBlocks";
import { countTemplatePages, getDocumentPages } from "./kpCanvasPages";
import { isCanvasLayoutMode } from "./kpCanvasLayout";
import type { KpInput, KpTemplateConfig, SpecItem } from "./types";
import "./kpDocumentFonts";

export function KpPagedDocumentPreview({
  template,
  input,
  items,
  dealId,
}: {
  template: KpTemplateConfig;
  input: KpInput;
  items: SpecItem[];
  dealId: string;
}) {
  const pages = React.useMemo(() => getDocumentPages(template), [template]);
  const pageCount = pages.length;
  const canvas = isCanvasLayoutMode(template);

  if (pageCount <= 1) {
    return (
      <KpDocumentFrame
        title="Лист A4 — как увидит клиент"
        subtitle="Обновляется при каждом изменении слева"
        toolbarExtra={
          <span className="text-[11px] text-[#9ca3af] px-2">1 страница</span>
        }
      >
        <KpPreview template={template} input={input} items={items} dealId={dealId} mode="document" />
      </KpDocumentFrame>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="text-xs text-text2 px-1">
        Документ на <strong className="text-white/90">{pageCount}</strong> листах
        {canvas ? " — позиции на холсте Figma." : " — разрывы в разделах («Новый лист»)."}
      </div>
      {pages.map((pageBlocks, index) => (
        <KpDocumentFrame
          key={`page-${index}`}
          title={`Страница ${index + 1} из ${pageCount}`}
          subtitle="Предпросмотр листа A4"
        >
          <KpPreview
            template={template}
            input={input}
            items={items}
            dealId={dealId}
            mode="document"
            blocksOverride={pageBlocks}
          />
        </KpDocumentFrame>
      ))}
    </div>
  );
}

export function useDocumentPageCount(template: KpTemplateConfig) {
  return React.useMemo(() => countTemplatePages(template), [template]);
}
