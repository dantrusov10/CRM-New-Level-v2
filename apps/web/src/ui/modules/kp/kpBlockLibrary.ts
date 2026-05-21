import type { KpBlockLibraryItem, KpPdfBlock, KpTemplateConfig } from "./types";
import { createCustomBlock } from "./kpPdfBlocks";

export function ensureBlockLibrary(template: KpTemplateConfig): KpBlockLibraryItem[] {
  return Array.isArray(template.blockLibrary) ? template.blockLibrary : [];
}

export function saveBlockToLibrary(template: KpTemplateConfig, block: KpPdfBlock, name: string): KpTemplateConfig {
  const lib = ensureBlockLibrary(template);
  const clone = JSON.parse(JSON.stringify(block)) as KpPdfBlock;
  clone.id = `lib_${Date.now().toString(36)}`;
  const item: KpBlockLibraryItem = {
    id: `entry_${Date.now().toString(36)}`,
    name: name.trim() || "Раздел",
    block: clone,
    createdAt: new Date().toISOString(),
  };
  return { ...template, blockLibrary: [...lib, item] };
}

export function insertLibraryBlock(template: KpTemplateConfig, entryId: string, blocks: KpPdfBlock[]): KpPdfBlock[] {
  const entry = ensureBlockLibrary(template).find((e) => e.id === entryId);
  if (!entry) return blocks;
  const b = JSON.parse(JSON.stringify(entry.block)) as KpPdfBlock;
  b.id = `${b.type}_${Math.random().toString(36).slice(2, 8)}`;
  if (b.type === "custom" && !b.bodyHtml) {
    Object.assign(b, createCustomBlock(b.title));
  }
  return [...blocks, { ...b, enabled: true }];
}
