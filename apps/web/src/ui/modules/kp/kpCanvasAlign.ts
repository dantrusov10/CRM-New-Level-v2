import type { KpPdfBlock } from "./types";

export function alignBlocksLeft(blocks: KpPdfBlock[], ids: string[], x: number) {
  const set = new Set(ids);
  return blocks.map((b) => {
    if (!set.has(b.id) || !b.rect) return b;
    return { ...b, rect: { ...b.rect, x } };
  });
}

export function alignBlocksCenterX(blocks: KpPdfBlock[], ids: string[], pageWidth: number) {
  const set = new Set(ids);
  return blocks.map((b) => {
    if (!set.has(b.id) || !b.rect) return b;
    const x = Math.round((pageWidth - b.rect.w) / 2);
    return { ...b, rect: { ...b.rect, x: Math.max(0, x) } };
  });
}

export function equalizeBlockWidths(blocks: KpPdfBlock[], ids: string[], w: number) {
  const set = new Set(ids);
  return blocks.map((b) => {
    if (!set.has(b.id) || !b.rect) return b;
    return { ...b, rect: { ...b.rect, w } };
  });
}

export function maxWidthOf(blocks: KpPdfBlock[], ids: string[]) {
  const set = new Set(ids);
  return blocks.reduce((m, b) => (set.has(b.id) && b.rect ? Math.max(m, b.rect.w) : m), 0);
}
