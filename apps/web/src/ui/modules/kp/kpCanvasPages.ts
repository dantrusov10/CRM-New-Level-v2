import { blocksOnCanvasPage, canvasPageIndices, isCanvasLayoutMode } from "./kpCanvasLayout";
import { ensurePdfBlocks } from "./kpPdfBlocks";
import { splitBlocksIntoPages } from "./kpPageLayout";
import type { KpPdfBlock, KpTemplateConfig } from "./types";

/** Страницы документа: flow — по разрывам; canvas — по pageIndex блоков */
export function getDocumentPages(template: KpTemplateConfig): KpPdfBlock[][] {
  const blocks = ensurePdfBlocks(template).filter((b) => b.enabled);
  if (!blocks.length) return [[]];

  if (isCanvasLayoutMode(template)) {
    const indices = canvasPageIndices(blocks);
    return indices.map((pi) => blocksOnCanvasPage(blocks, pi));
  }
  return splitBlocksIntoPages(blocks);
}

export function countTemplatePages(template: KpTemplateConfig): number {
  return getDocumentPages(template).length;
}
