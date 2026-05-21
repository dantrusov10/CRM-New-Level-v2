import type { KpTemplateConfig } from "./types";
import { docxFileToHtml } from "./kpDocxImport";
import { createCustomBlock, ensurePdfBlocks } from "./kpPdfBlocks";
import { migrateFlowBlocksToCanvas, isCanvasLayoutMode } from "./kpCanvasLayout";

/** Импорт .docx как основа шаблона: текст в custom-блок + сохранение остальных настроек draft. */
export async function importDocxAsFullTemplate(
  draft: KpTemplateConfig,
  file: File,
): Promise<KpTemplateConfig> {
  const html = await docxFileToHtml(file);
  if (!html.trim()) throw new Error("Документ пустой");

  const custom = {
    ...createCustomBlock(file.name.replace(/\.docx$/i, "") || "Документ Word"),
    bodyHtml: html,
    enabled: true,
    pageBreakBefore: false,
  };

  let pdfBlocks = ensurePdfBlocks(draft).filter((b) => b.type !== "custom" || b.enabled);
  const hasCustom = pdfBlocks.some((b) => b.type === "custom");
  pdfBlocks = hasCustom
    ? pdfBlocks.map((b) => (b.type === "custom" ? { ...custom, id: b.id } : b))
    : [...pdfBlocks, custom];

  let next: KpTemplateConfig = { ...draft, pdfBlocks, name: draft.name || file.name.replace(/\.docx$/i, "") };
  if (isCanvasLayoutMode(next)) {
    next = { ...next, pdfBlocks: migrateFlowBlocksToCanvas(pdfBlocks, next) };
  }
  return next;
}
