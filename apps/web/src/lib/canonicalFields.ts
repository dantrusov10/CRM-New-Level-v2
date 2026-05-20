/**
 * Канонические имена полей PocketBase для сделки.
 * Одна сущность = одно поле в коллекции `deals` (field_name).
 * Алиасы — старые/кастомные имена в settings_fields и deal_field_values.
 */
export type DealCanonicalField =
  | "title"
  | "budget"
  | "turnover"
  | "margin_percent"
  | "discount_percent"
  | "sales_channel"
  | "partner"
  | "distributor"
  | "purchase_format"
  | "activity_type"
  | "presale"
  | "attraction_channel"
  | "infrastructure_size"
  | "endpoints"
  | "current_score"
  | "delivery_date"
  | "expected_payment_date"
  | "company_id"
  | "stage_id"
  | "responsible_id";

export type DealFieldEntity = {
  /** Поле в коллекции deals */
  field: DealCanonicalField;
  label: string;
  aliases: string[];
};

/** Реестр сущностей: бюджет, оборот, канал… */
export const DEAL_FIELD_ENTITIES: DealFieldEntity[] = [
  { field: "budget", label: "Бюджет", aliases: ["budget", "deal_budget", "бюджет", "sum", "сумма"] },
  { field: "turnover", label: "Оборот", aliases: ["turnover", "deal_turnover", "оборот", "revenue"] },
  { field: "margin_percent", label: "Маржа %", aliases: ["margin_percent", "margin", "маржа"] },
  { field: "discount_percent", label: "Скидка %", aliases: ["discount_percent", "discount", "скидка"] },
  { field: "sales_channel", label: "Канал продаж", aliases: ["sales_channel", "channel", "канал", "канал_продаж"] },
  { field: "partner", label: "Партнёр", aliases: ["partner", "партнер", "партнёр"] },
  { field: "distributor", label: "Дистрибьютор", aliases: ["distributor", "дистрибьютор"] },
  { field: "purchase_format", label: "Формат закупки", aliases: ["purchase_format", "формат_закупки"] },
  { field: "activity_type", label: "Тип активности", aliases: ["activity_type", "activity", "активность"] },
  { field: "presale", label: "Presale", aliases: ["presale"] },
  { field: "attraction_channel", label: "Канал привлечения", aliases: ["attraction_channel", "канал_привлечения"] },
  { field: "infrastructure_size", label: "Инфраструктура", aliases: ["infrastructure_size", "инфраструктура"] },
  { field: "endpoints", label: "Эндпоинты", aliases: ["endpoints", "эндпоинты"] },
  { field: "current_score", label: "AI скор", aliases: ["current_score", "score", "probability", "вероятность"] },
];

const ALIAS_TO_CANONICAL = new Map<string, DealCanonicalField>();
for (const entity of DEAL_FIELD_ENTITIES) {
  for (const alias of entity.aliases) {
    ALIAS_TO_CANONICAL.set(alias.trim().toLowerCase(), entity.field);
  }
  ALIAS_TO_CANONICAL.set(entity.field, entity.field);
}

/** Привести field_name из settings_fields / импорта к полю deals.* */
export function normalizeDealFieldName(fieldName: string | null | undefined): DealCanonicalField | null {
  if (!fieldName?.trim()) return null;
  return ALIAS_TO_CANONICAL.get(fieldName.trim().toLowerCase()) ?? null;
}

export function dealFieldLabel(field: DealCanonicalField): string {
  return DEAL_FIELD_ENTITIES.find((e) => e.field === field)?.label ?? field;
}

/** Поля, уже выведенные в карточке сделки (не дублировать в DynamicEntityForm). */
export const DEAL_CARD_STATIC_FIELDS: DealCanonicalField[] = [
  "title",
  "company_id",
  "stage_id",
  "budget",
  "responsible_id",
];

/** Все системные поля deals — не создавать для них deal_field_values. */
export const DEAL_SYSTEM_PB_FIELDS: DealCanonicalField[] = [
  "title",
  "budget",
  "turnover",
  "margin_percent",
  "discount_percent",
  "sales_channel",
  "partner",
  "distributor",
  "purchase_format",
  "activity_type",
  "presale",
  "attraction_channel",
  "infrastructure_size",
  "endpoints",
  "current_score",
  "delivery_date",
  "expected_payment_date",
  "company_id",
  "stage_id",
  "responsible_id",
];

export function isDealFieldExcludedFromDynamicForm(
  fieldName: string,
  extraExclude: string[] = [],
): boolean {
  const canonical = normalizeDealFieldName(fieldName);
  const exclude = new Set([
    ...DEAL_CARD_STATIC_FIELDS,
    ...extraExclude.map((x) => x.trim().toLowerCase()),
  ]);
  if (canonical && exclude.has(canonical)) return true;
  return exclude.has(fieldName.trim().toLowerCase());
}
