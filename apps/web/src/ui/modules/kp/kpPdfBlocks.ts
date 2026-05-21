import type { KpBlockRect, KpBlockStyle, KpPdfBlock, KpPdfBlockType, KpTemplateConfig } from "./types";

export type { KpPdfBlock, KpPdfBlockType };

export const KP_PDF_BLOCK_META: Record<KpPdfBlockType, { label: string; hint: string }> = {
  header: { label: "Шапка", hint: "Логотип, ваша компания, название клиента" },
  client_cards: { label: "Реквизиты клиента", hint: "Email и ИНН — блок под шапкой" },
  technical: { label: "Техническое описание", hint: "Текст решения — обычно для ТКП, перед таблицей" },
  custom: { label: "Свой раздел", hint: "Произвольный текст: о компании, этапы, SLA" },
  specification_table: { label: "Таблица товаров", hint: "Позиции из прайса — основа КП" },
  totals: { label: "Итоговая сумма", hint: "Подтаблица: без НДС, НДС, к оплате" },
  conditions: { label: "Условия сделки", hint: "Оплата, сроки, комментарий менеджера" },
  signature: { label: "Подпись и оговорка", hint: "Текст внизу страницы и контакты менеджера" },
};

const SYSTEM_BLOCK_TYPES = new Set<KpPdfBlockType>([
  "header",
  "client_cards",
  "technical",
  "specification_table",
  "totals",
  "conditions",
  "signature",
]);

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

function normalizeBlock(item: KpPdfBlock, index: number): KpPdfBlock | null {
  const type = String(item.type || "") as KpPdfBlockType;
  if (!KP_PDF_BLOCK_META[type]) return null;
  const rectRaw = item.rect;
  let rect: KpBlockRect | undefined;
  if (rectRaw && typeof rectRaw === "object") {
    rect = {
      pageIndex: Number(rectRaw.pageIndex) || 0,
      x: Number(rectRaw.x) || 0,
      y: Number(rectRaw.y) || 0,
      w: Number(rectRaw.w) || 0,
      h: rectRaw.h != null ? Number(rectRaw.h) : undefined,
      zIndex: rectRaw.zIndex != null ? Number(rectRaw.zIndex) : undefined,
    };
  }
  const styleRaw = item.style;
  let style: KpBlockStyle | undefined;
  if (styleRaw && typeof styleRaw === "object") {
    style = { ...(styleRaw as KpBlockStyle) };
  }

  return {
    id: String(item.id || blockIdForType(type, index)),
    type,
    enabled: item.enabled !== false,
    title: item.title ? String(item.title) : undefined,
    bodyHtml: item.bodyHtml != null ? String(item.bodyHtml) : undefined,
    pageBreakBefore: !!item.pageBreakBefore,
    rect,
    style,
  };
}

export function ensurePdfBlocks(template: KpTemplateConfig): KpPdfBlock[] {
  const raw = template.pdfBlocks;
  if (!Array.isArray(raw) || !raw.length) return deepCloneBlocks(DEFAULT_KP_PDF_BLOCKS);

  const normalized: KpPdfBlock[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (!item || typeof item !== "object") continue;
    const block = normalizeBlock(item as KpPdfBlock, i);
    if (block) normalized.push(block);
  }
  if (!normalized.length) return deepCloneBlocks(DEFAULT_KP_PDF_BLOCKS);

  const presentSystem = new Set(normalized.filter((b) => SYSTEM_BLOCK_TYPES.has(b.type)).map((b) => b.type));
  for (const def of DEFAULT_KP_PDF_BLOCKS) {
    if (!presentSystem.has(def.type)) normalized.push({ ...def, id: blockIdForType(def.type, normalized.length) });
  }
  return normalized;
}

export function deepCloneBlocks(blocks: KpPdfBlock[]): KpPdfBlock[] {
  return JSON.parse(JSON.stringify(blocks)) as KpPdfBlock[];
}

export function createCustomBlock(title = "Новый раздел"): KpPdfBlock {
  const id = `custom_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`;
  return {
    id,
    type: "custom",
    enabled: true,
    title,
    bodyHtml: "<p>Текст раздела. Можно использовать несколько абзацев.</p>",
    pageBreakBefore: false,
  };
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
