import type { KpTemplateConfig } from "./types";

export type KpPdfBlockType =
  | "header"
  | "client_cards"
  | "technical"
  | "specification_table"
  | "totals"
  | "conditions"
  | "signature";

export type KpPdfBlock = {
  id: string;
  type: KpPdfBlockType;
  enabled: boolean;
  title?: string;
};

export const KP_PDF_BLOCK_META: Record<KpPdfBlockType, { label: string; hint: string }> = {
  header: { label: "Шапка", hint: "Логотип, ваша компания, название клиента" },
  client_cards: { label: "Реквизиты клиента", hint: "Email и ИНН — блок под шапкой" },
  technical: { label: "Техническое описание", hint: "Текст решения — обычно для ТКП, перед таблицей" },
  specification_table: { label: "Таблица товаров", hint: "Позиции из прайса — основа КП" },
  totals: { label: "Итоговая сумма", hint: "Подтаблица: без НДС, НДС, к оплате" },
  conditions: { label: "Условия сделки", hint: "Оплата, сроки, комментарий менеджера" },
  signature: { label: "Подпись и оговорка", hint: "Текст внизу страницы и контакты менеджера" },
};

export const DEFAULT_KP_PDF_BLOCKS: KpPdfBlock[] = [
  { id: "blk_header", type: "header", enabled: true },
  { id: "blk_client", type: "client_cards", enabled: true },
  { id: "blk_technical", type: "technical", enabled: false },
  { id: "blk_table", type: "specification_table", enabled: true },
  { id: "blk_totals", type: "totals", enabled: true },
  { id: "blk_conditions", type: "conditions", enabled: true },
  { id: "blk_signature", type: "signature", enabled: true },
];

function blockIdForType(type: KpPdfBlockType, index: number) {
  return `blk_${type}_${index}`;
}

export function ensurePdfBlocks(template: KpTemplateConfig): KpPdfBlock[] {
  const raw = template.pdfBlocks;
  if (!Array.isArray(raw) || !raw.length) return deepCloneBlocks(DEFAULT_KP_PDF_BLOCKS);

  const normalized: KpPdfBlock[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (!item || typeof item !== "object") continue;
    const type = String((item as KpPdfBlock).type || "") as KpPdfBlockType;
    if (!KP_PDF_BLOCK_META[type]) continue;
    normalized.push({
      id: String((item as KpPdfBlock).id || blockIdForType(type, i)),
      type,
      enabled: (item as KpPdfBlock).enabled !== false,
      title: String((item as KpPdfBlock).title || "") || undefined,
    });
  }
  if (!normalized.length) return deepCloneBlocks(DEFAULT_KP_PDF_BLOCKS);

  const present = new Set(normalized.map((b) => b.type));
  for (const def of DEFAULT_KP_PDF_BLOCKS) {
    if (!present.has(def.type)) normalized.push({ ...def, id: blockIdForType(def.type, normalized.length) });
  }
  return normalized;
}

export function deepCloneBlocks(blocks: KpPdfBlock[]): KpPdfBlock[] {
  return JSON.parse(JSON.stringify(blocks)) as KpPdfBlock[];
}

export function applyPdfBlockPresetForDoc(
  preset: "standard" | "minimal" | "full",
  documentType: "kp" | "tkp" = "kp",
): KpPdfBlock[] {
  const blocks = applyPdfBlockPreset(preset);
  if (documentType !== "tkp") return blocks;
  return blocks.map((b) => (b.type === "technical" ? { ...b, enabled: true } : b));
}

export function applyPdfBlockPreset(preset: "standard" | "minimal" | "full"): KpPdfBlock[] {
  if (preset === "minimal") {
    return [
      { id: "blk_header", type: "header", enabled: true },
      { id: "blk_table", type: "specification_table", enabled: true },
      { id: "blk_totals", type: "totals", enabled: true },
      { id: "blk_signature", type: "signature", enabled: true },
    ];
  }
  if (preset === "full") {
    return deepCloneBlocks(
      DEFAULT_KP_PDF_BLOCKS.map((b) => (b.type === "technical" ? { ...b, enabled: true } : b)),
    );
  }
  return [
    { id: "blk_header", type: "header", enabled: true },
    { id: "blk_client", type: "client_cards", enabled: true },
    { id: "blk_table", type: "specification_table", enabled: true },
    { id: "blk_totals", type: "totals", enabled: true },
    { id: "blk_conditions", type: "conditions", enabled: false },
    { id: "blk_signature", type: "signature", enabled: true },
  ];
}
