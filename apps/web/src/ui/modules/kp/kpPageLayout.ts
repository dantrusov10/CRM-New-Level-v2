import type { KpPdfBlock } from "./types";

/** Высота A4 при ширине 794px */
export const KP_A4_HEIGHT_PX = Math.round(794 * 1.414);

export function splitBlocksIntoPages(blocks: KpPdfBlock[]): KpPdfBlock[][] {
  const enabled = blocks.filter((b) => b.enabled);
  if (!enabled.length) return [[]];

  const pages: KpPdfBlock[][] = [[]];
  for (const block of enabled) {
    if (block.pageBreakBefore && pages[pages.length - 1].length > 0) {
      pages.push([]);
    }
    pages[pages.length - 1].push(block);
  }
  return pages.filter((p) => p.length > 0);
}

export function countDocumentPages(blocks: KpPdfBlock[]): number {
  return splitBlocksIntoPages(blocks).length;
}
