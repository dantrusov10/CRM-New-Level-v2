import mammoth from "mammoth";
import type { KpPdfBlock, KpTemplateConfig } from "./types";
import { createCustomBlock, ensurePdfBlocks } from "./kpPdfBlocks";
import { sanitizeKpHtml } from "./kpHtmlSanitize";

export async function docxFileToHtml(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer });
  return sanitizeKpHtml(result.value || "");
}

export function htmlFileToHtml(text: string): string {
  return sanitizeKpHtml(text);
}

export function customBlockFromHtml(html: string, title = "Текст из документа"): KpPdfBlock {
  return {
    ...createCustomBlock(),
    enabled: true,
    title,
    bodyHtml: sanitizeKpHtml(html),
    pageBreakBefore: false,
  };
}

/** Добавить раздел из Word/HTML в конец шаблона. */
export function mergeImportedHtmlIntoTemplate(
  draft: KpTemplateConfig,
  html: string,
  title?: string,
): KpTemplateConfig {
  const blocks = ensurePdfBlocks(draft);
  const block = customBlockFromHtml(html, title);
  return { ...draft, pdfBlocks: [...blocks, block] };
}

/** Импорт целого .docx как один большой custom-раздел (стартовая точка для кастомизации). */
export async function importDocxIntoTemplate(
  draft: KpTemplateConfig,
  file: File,
  title?: string,
): Promise<KpTemplateConfig> {
  const html = await docxFileToHtml(file);
  if (!html.trim()) throw new Error("Документ пустой или не удалось извлечь текст");
  return mergeImportedHtmlIntoTemplate(draft, html, title || file.name.replace(/\.docx$/i, ""));
}
