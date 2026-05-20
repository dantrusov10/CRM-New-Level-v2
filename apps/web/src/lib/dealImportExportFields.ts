import { DEAL_FIELD_ENTITIES, dealFieldLabel, normalizeDealFieldName } from "./canonicalFields";

/** Колонки экспорта сделок (канон PB + подписи). */
export const DEAL_EXPORT_COLUMNS: Array<{ key: string; label: string; canonical?: string }> = [
  { key: "title", label: "Название сделки", canonical: "title" },
  { key: "company", label: "Компания" },
  { key: "inn", label: "ИНН" },
  { key: "stage", label: "Этап" },
  { key: "responsible", label: "Ответственный" },
  ...DEAL_FIELD_ENTITIES.map((e) => ({ key: e.field, label: e.label, canonical: e.field })),
  { key: "delivery_date", label: "Поставка", canonical: "delivery_date" },
  { key: "expected_payment_date", label: "Ожид. оплата", canonical: "expected_payment_date" },
  { key: "updated", label: "Обновлено" },
];

export const DEAL_EXPORT_DEFAULT_FIELDS: Record<string, boolean> = Object.fromEntries(
  DEAL_EXPORT_COLUMNS.map((c) => [c.key, ["title", "company", "stage", "responsible", "budget", "turnover", "sales_channel"].includes(c.key)]),
);

/** Алиасы заголовков CSV/Excel → каноническое поле deals. */
export function buildDealImportHeaderMap(): Record<string, string[]> {
  const map: Record<string, string[]> = {
    title: ["title", "название", "сделка", "deal"],
    company: ["company", "компания", "company_name"],
    inn: ["inn", "инн"],
    stage: ["stage", "этап", "stage_name"],
    responsible: ["responsible", "ответственный", "owner"],
  };
  for (const e of DEAL_FIELD_ENTITIES) {
    map[e.field] = [e.field, e.label.toLowerCase(), ...e.aliases];
  }
  return map;
}

/** Нормализация mapping из UI в канонические ключи deals. */
export function normalizeDealImportMapping(mapping: Record<string, string>): Record<string, string> {
  const headerMap = buildDealImportHeaderMap();
  const out: Record<string, string> = {};
  for (const [header, field] of Object.entries(mapping)) {
    if (!field?.trim()) continue;
    const canon = normalizeDealFieldName(field) ?? normalizeDealFieldName(header);
    if (canon) out[header] = canon;
    else out[header] = field;
  }
  for (const [canonKey, aliases] of Object.entries(headerMap)) {
    if (!out[canonKey]) {
      const hit = Object.entries(mapping).find(([, v]) => aliases.includes(String(v).toLowerCase()));
      if (hit) out[hit[0]] = canonKey;
    }
  }
  return out;
}

export function dealCanonicalKeysForImport(): string[] {
  return ["title", "company_id", "stage_id", "responsible_id", ...DEAL_FIELD_ENTITIES.map((e) => e.field)];
}

export function labelForCanonicalField(field: string): string {
  const c = normalizeDealFieldName(field);
  return c ? dealFieldLabel(c) : field;
}
