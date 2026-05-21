import { KP_A4_WIDTH_PX } from "./KpDocumentFrame";
import { KP_A4_HEIGHT_PX } from "./kpPageLayout";
import type { KpBlockRect, KpPdfBlock, KpPdfBlockType, KpTemplateConfig } from "./types";

export const CANVAS_PAGE_WIDTH = KP_A4_WIDTH_PX;
export const CANVAS_PAGE_HEIGHT = KP_A4_HEIGHT_PX;

const DEFAULT_H: Partial<Record<KpPdfBlockType, number>> = {
  header: 130,
  client_cards: 72,
  technical: 140,
  custom: 120,
  specification_table: 220,
  totals: 100,
  conditions: 110,
  signature: 90,
};

export function isCanvasLayoutMode(template: KpTemplateConfig): boolean {
  return template.pdfDesign?.layoutMode === "canvas";
}

export function canvasMarginPx(template: KpTemplateConfig): number {
  const mm = Number(template.pdfDesign?.pageMarginMm ?? 12);
  return Math.round((mm * CANVAS_PAGE_WIDTH) / 210);
}

export function canvasInnerWidth(template: KpTemplateConfig): number {
  return CANVAS_PAGE_WIDTH - canvasMarginPx(template) * 2;
}

export function defaultRectForBlock(
  type: KpPdfBlockType,
  index: number,
  template: KpTemplateConfig,
  pageIndex = 0,
): KpBlockRect {
  const margin = canvasMarginPx(template);
  const w = canvasInnerWidth(template);
  const h = DEFAULT_H[type] ?? 100;
  const y = margin + index * (h + 14);
  return {
    pageIndex,
    x: margin,
    y: Math.min(y, CANVAS_PAGE_HEIGHT - h - margin),
    w,
    h,
    zIndex: index + 1,
  };
}

export function ensureBlockRects(blocks: KpPdfBlock[], template: KpTemplateConfig): KpPdfBlock[] {
  let pageIndex = 0;
  let indexOnPage = 0;
  return blocks.map((b, globalIndex) => {
    if (b.pageBreakBefore && globalIndex > 0) {
      pageIndex += 1;
      indexOnPage = 0;
    }
    const rect =
      b.rect && b.rect.w > 0
        ? {
            pageIndex: b.rect.pageIndex ?? pageIndex,
            x: b.rect.x,
            y: b.rect.y,
            w: b.rect.w,
            h: b.rect.h,
            zIndex: b.rect.zIndex ?? globalIndex + 1,
          }
        : defaultRectForBlock(b.type, indexOnPage, template, pageIndex);
    indexOnPage += 1;
    return { ...b, rect, pageBreakBefore: false };
  });
}

/** Миграция из flow в canvas: сохраняем разрывы страниц как pageIndex */
export function migrateFlowBlocksToCanvas(blocks: KpPdfBlock[], template: KpTemplateConfig): KpPdfBlock[] {
  let pageIndex = 0;
  let indexOnPage = 0;
  return blocks.map((b, i) => {
    if (!b.enabled) return b;
    if (b.pageBreakBefore && i > 0 && indexOnPage > 0) {
      pageIndex += 1;
      indexOnPage = 0;
    }
    const rect = defaultRectForBlock(b.type, indexOnPage, template, pageIndex);
    indexOnPage += 1;
    return { ...b, rect, pageBreakBefore: false };
  });
}

export function canvasPageIndices(blocks: KpPdfBlock[]): number[] {
  const pages = new Set<number>();
  for (const b of blocks.filter((x) => x.enabled)) {
    pages.add(b.rect?.pageIndex ?? 0);
  }
  if (!pages.size) pages.add(0);
  return [...pages].sort((a, b) => a - b);
}

export function blocksOnCanvasPage(blocks: KpPdfBlock[], pageIndex: number): KpPdfBlock[] {
  return blocks
    .filter((b) => b.enabled && (b.rect?.pageIndex ?? 0) === pageIndex)
    .sort((a, b) => (a.rect?.zIndex ?? 0) - (b.rect?.zIndex ?? 0));
}

export function snapCanvasValue(v: number, grid: number, enabled: boolean): number {
  if (!enabled || grid <= 0) return Math.round(v);
  return Math.round(v / grid) * grid;
}

// re-export ensure from kpPdfBlocks would be circular - import ensurePdfBlocks in callers
