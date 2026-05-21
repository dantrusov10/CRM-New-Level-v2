import type { KpDocumentType, KpPdfDesign, KpTemplateConfig } from "./types";
import { ensureBlockRects, isCanvasLayoutMode, migrateFlowBlocksToCanvas } from "./kpCanvasLayout";
import { applyDesignPreset } from "./kpDesign";
import { applyPdfBlockPresetForDoc } from "./kpPdfBlocks";

export type KpTemplatePreset = {
  id: string;
  name: string;
  description: string;
  documentType: KpDocumentType;
  accentColor: string;
  designPreset: "classic" | "modern" | "minimal";
  designExtra?: Partial<KpPdfDesign>;
  blockPreset: "standard" | "minimal" | "full";
  branding?: {
    footerText?: string;
    disclaimer?: string;
    technicalIntroDefault?: string;
  };
};

/** Готовые стили КП/ТКП — коллекция для быстрого старта в ЛК. */
export const KP_TEMPLATE_PRESETS: KpTemplatePreset[] = [
  {
    id: "kp-corporate-blue",
    name: "Корпоративное КП",
    description: "Синий акцент, классическая таблица, все основные разделы",
    documentType: "kp",
    accentColor: "#004EEB",
    designPreset: "classic",
    blockPreset: "standard",
    branding: {
      footerText: "sales@company.ru · +7 (495) 000-00-00",
      disclaimer: "Документ не является публичной офертой. Срок действия указан в шапке.",
    },
  },
  {
    id: "kp-minimal-slate",
    name: "Лаконичное КП",
    description: "Серый акцент, компактный макет, минимум декора",
    documentType: "kp",
    accentColor: "#334155",
    designPreset: "minimal",
    designExtra: { fontFamily: "system", tableStyle: "plain" },
    blockPreset: "minimal",
  },
  {
    id: "kp-modern-teal",
    name: "Современное КП",
    description: "Цветная шапка, полосатая таблица, Open Sans",
    documentType: "kp",
    accentColor: "#0D9488",
    designPreset: "modern",
    designExtra: { fontFamily: "open-sans", tableHeaderUseAccent: true },
    blockPreset: "standard",
  },
  {
    id: "kp-premium-serif",
    name: "Премиум КП",
    description: "Merriweather, тёплый фон листа, крупная типографика",
    documentType: "kp",
    accentColor: "#6D28D9",
    designPreset: "classic",
    designExtra: {
      fontFamily: "merriweather",
      fontScale: "lg",
      paperTone: "warm",
      paperBg: "#faf8f5",
      bodyFontSizePt: 11.5,
      headingFontSizePt: 18,
    },
    blockPreset: "full",
  },
  {
    id: "tkp-engineering",
    name: "Инженерное ТКП",
    description: "Техблок + полная спецификация, Roboto, bordered",
    documentType: "tkp",
    accentColor: "#1E40AF",
    designPreset: "classic",
    designExtra: { fontFamily: "roboto" },
    blockPreset: "full",
    branding: {
      technicalIntroDefault:
        "Состав решения: лицензии, внедрение, обучение. Этапы: аудит → пилот → промышленная эксплуатация. SLA 8×5.",
    },
  },
  {
    id: "tkp-modern-dark",
    name: "ТКП Modern",
    description: "Montserrat, современная шапка, акцент в таблице",
    documentType: "tkp",
    accentColor: "#0F766E",
    designPreset: "modern",
    designExtra: { fontFamily: "montserrat" },
    blockPreset: "full",
    branding: {
      technicalIntroDefault: "Техническое описание, гарантии, сроки внедрения и поддержки.",
    },
  },
];

export function applyTemplatePreset(draft: KpTemplateConfig, preset: KpTemplatePreset): KpTemplateConfig {
  const designBase = applyDesignPreset(preset.designPreset);
  let pdfBlocks = applyPdfBlockPresetForDoc(preset.blockPreset, preset.documentType);
  const next: KpTemplateConfig = {
    ...draft,
    documentType: preset.documentType,
    branding: {
      ...(draft.branding || {}),
      primaryColor: preset.accentColor,
      ...(preset.branding || {}),
    },
    pdfDesign: {
      ...(draft.pdfDesign || {}),
      ...designBase,
      ...(preset.designExtra || {}),
    },
    pdfBlocks,
  };
  if (isCanvasLayoutMode(next)) {
    pdfBlocks = ensureBlockRects(migrateFlowBlocksToCanvas(pdfBlocks, next), next);
    return { ...next, pdfBlocks };
  }
  return next;
}
