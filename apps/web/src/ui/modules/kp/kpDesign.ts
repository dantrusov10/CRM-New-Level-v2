import type { KpPdfDesign, KpTemplateConfig } from "./types";

export type LayoutStyle = "classic" | "modern" | "compact";
export type FontScale = "sm" | "md" | "lg";
export type TableStyle = "bordered" | "plain" | "striped";
export type PaperTone = "white" | "warm";

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

export function normalizePdfDesign(template: KpTemplateConfig): Required<
  Pick<KpPdfDesign, "layoutStyle" | "fontScale" | "tableStyle" | "paperTone">
> & KpPdfDesign {
  const d = template.pdfDesign || {};
  const accent = template.branding?.primaryColor || "#004EEB";
  const tone = (d.paperTone as PaperTone) || "white";
  const paperBg = d.paperBg || (tone === "warm" ? "#faf8f5" : "#ffffff");

  return {
    layoutStyle: (d.layoutStyle as LayoutStyle) || "classic",
    fontScale: (d.fontScale as FontScale) || "md",
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
      tableStyle: "plain",
      paperTone: "white",
      tableHeaderUseAccent: false,
      paperBg: "#ffffff",
    };
  }
  return {
    layoutStyle: "classic",
    fontScale: "md",
    tableStyle: "bordered",
    paperTone: "white",
    tableHeaderUseAccent: false,
    paperBg: "#ffffff",
  };
}

export function designCssVars(template: KpTemplateConfig): Record<string, string> {
  const d = normalizePdfDesign(template);
  const headBg = d.tableHeaderUseAccent ? d.accentColor : d.tableHeaderBg || "#EEF1F6";
  const headText = d.tableHeaderUseAccent ? "#ffffff" : d.tableHeaderText || "#374151";
  return {
    "--kp-accent": d.accentColor || "#004EEB",
    "--kp-paper-bg": d.paperBg || "#ffffff",
    "--kp-text": d.textColor || "#111827",
    "--kp-table-head-bg": headBg || "#EEF1F6",
    "--kp-table-head-text": headText || "#374151",
  };
}

export type ResolvedPdfDesign = ReturnType<typeof normalizePdfDesign>;

