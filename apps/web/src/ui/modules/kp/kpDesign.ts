import { fontStackByCatalogId } from "./kpFontCatalog";
import type { KpFontFamilyId, KpPdfDesign, KpTemplateConfig } from "./types";

export type LayoutStyle = "classic" | "modern" | "compact";
export type FontScale = "sm" | "md" | "lg";
export type TableStyle = "bordered" | "plain" | "striped";
export type PaperTone = "white" | "warm";

const FONT_SCALE_PT: Record<FontScale, { body: number; heading: number }> = {
  sm: { body: 9.5, heading: 14 },
  md: { body: 11, heading: 16 },
  lg: { body: 12.5, heading: 18 },
};

export const LAYOUT_OPTIONS: { id: LayoutStyle; label: string; desc: string }[] = [
  { id: "classic", label: "Классический", desc: "Линия под шапкой, строгая таблица" },
  { id: "modern", label: "Современный", desc: "Цветная полоса в шапке" },
  { id: "compact", label: "Компактный", desc: "Меньше отступов — больше на листе" },
];

export const FONT_OPTIONS: { id: FontScale; label: string }[] = [
  { id: "sm", label: "Мелкий" },
  { id: "md", label: "Обычный" },
  { id: "lg", label: "Крупный" },
];

export const TABLE_OPTIONS: { id: TableStyle; label: string }[] = [
  { id: "bordered", label: "С рамками" },
  { id: "striped", label: "Полосатые строки" },
  { id: "plain", label: "Минимум линий" },
];

export const PAPER_OPTIONS: { id: PaperTone; label: string; bg: string }[] = [
  { id: "white", label: "Белый", bg: "#ffffff" },
  { id: "warm", label: "Тёплый", bg: "#faf8f5" },
];

export function normalizePdfDesign(template: KpTemplateConfig) {
  const d = template.pdfDesign || {};
  const accent = template.branding?.primaryColor || "#004EEB";
  const tone = (d.paperTone as PaperTone) || "white";
  const paperBg = d.paperBg || (tone === "warm" ? "#faf8f5" : "#ffffff");
  const scale = (d.fontScale as FontScale) || "md";
  const scalePt = FONT_SCALE_PT[scale];
  const fontFamily = (d.fontFamily as KpFontFamilyId) || "inter";

  return {
    layoutMode: d.layoutMode === "canvas" ? "canvas" : "flow",
    layoutStyle: (d.layoutStyle as LayoutStyle) || "classic",
    fontScale: scale,
    fontFamily,
    fontStack: fontStackByCatalogId(fontFamily),
    bodyFontSizePt: Number(d.bodyFontSizePt) > 0 ? Number(d.bodyFontSizePt) : scalePt.body,
    headingFontSizePt: Number(d.headingFontSizePt) > 0 ? Number(d.headingFontSizePt) : scalePt.heading,
    lineHeight: Number(d.lineHeight) > 0 ? Number(d.lineHeight) : 1.45,
    letterSpacingPx: Number(d.letterSpacingPx) >= 0 ? Number(d.letterSpacingPx) : 0,
    pageMarginMm: Number(d.pageMarginMm) >= 0 ? Number(d.pageMarginMm) : 12,
    canvasGridPx: Number(d.canvasGridPx) > 0 ? Number(d.canvasGridPx) : 8,
    canvasSnap: d.canvasSnap !== false,
    canvasShowGrid: d.canvasShowGrid !== false,
    pageBackgroundUrl: d.pageBackgroundUrl ? String(d.pageBackgroundUrl) : "",
    pageBackgroundOpacity:
      d.pageBackgroundOpacity != null ? Math.min(1, Math.max(0, Number(d.pageBackgroundOpacity))) : 1,
    secondaryColor: d.secondaryColor || "#6b7280",
    tableStyle: (d.tableStyle as TableStyle) || "bordered",
    paperTone: tone,
    paperBg,
    textColor: d.textColor || "#111827",
    tableHeaderBg: d.tableHeaderBg || "#EEF1F6",
    tableHeaderText: d.tableHeaderText || "#374151",
    tableHeaderUseAccent: d.tableHeaderUseAccent === true,
    accentColor: accent as string,
    showValidityLine: d.showValidityLine !== false,
    validityDays: Number(d.validityDays) > 0 ? Number(d.validityDays) : 10,
  };
}

export function applyDesignPreset(preset: "classic" | "modern" | "minimal"): Partial<KpPdfDesign> {
  if (preset === "modern") {
    return {
      layoutStyle: "modern",
      fontScale: "md",
      fontFamily: "inter",
      tableStyle: "striped",
      paperTone: "white",
      tableHeaderUseAccent: true,
      paperBg: "#ffffff",
    };
  }
  if (preset === "minimal") {
    return {
      layoutStyle: "compact",
      fontScale: "sm",
      fontFamily: "system",
      tableStyle: "plain",
      paperTone: "white",
      tableHeaderUseAccent: false,
      paperBg: "#ffffff",
      pageMarginMm: 10,
    };
  }
  return {
    layoutStyle: "classic",
    fontScale: "md",
    fontFamily: "inter",
    tableStyle: "bordered",
    paperTone: "white",
    tableHeaderUseAccent: false,
    paperBg: "#ffffff",
    pageMarginMm: 12,
  };
}

export function designCssVars(template: KpTemplateConfig): Record<string, string> {
  const d = normalizePdfDesign(template);
  const headBg = d.tableHeaderUseAccent ? d.accentColor : d.tableHeaderBg || "#EEF1F6";
  const headText = d.tableHeaderUseAccent ? "#ffffff" : d.tableHeaderText || "#374151";
  const marginPx = Math.round((d.pageMarginMm * 794) / 210);

  return {
    "--kp-accent": d.accentColor || "#004EEB",
    "--kp-secondary": d.secondaryColor,
    "--kp-paper-bg": d.paperBg || "#ffffff",
    "--kp-text": d.textColor || "#111827",
    "--kp-font-stack": d.fontStack,
    "--kp-body-pt": String(d.bodyFontSizePt),
    "--kp-heading-pt": String(d.headingFontSizePt),
    "--kp-line-height": String(d.lineHeight),
    "--kp-letter-spacing": d.letterSpacingPx ? `${d.letterSpacingPx}px` : "0",
    "--kp-page-margin": `${marginPx}px`,
    "--kp-table-head-bg": headBg || "#EEF1F6",
    "--kp-table-head-text": headText || "#374151",
  };
}

export type ResolvedPdfDesign = ReturnType<typeof normalizePdfDesign>;
