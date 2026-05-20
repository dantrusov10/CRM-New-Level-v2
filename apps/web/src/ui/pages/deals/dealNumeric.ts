import { pb } from "../../../lib/pb";
import { normalizeDealFieldName } from "../../../lib/canonicalFields";
import type { Deal } from "../../../lib/types";

/** Нормализация числа из PB (number | string с пробелами). */
export function parseDealNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = String(value).replace(/\s/g, "").replace(",", ".");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function dealBudget(deal: Deal): number | null {
  return parseDealNumber(deal.budget);
}

export function dealTurnover(deal: Deal): number | null {
  return parseDealNumber(deal.turnover);
}

type FieldValueRow = {
  deal_id?: string;
  field_id?: string;
  value_number?: number | null;
  value_text?: string | null;
};

/** Подмешать бюджет/оборот из deal_field_values, если в deals.* пусто. */
export async function enrichDealsNumericFields(deals: Deal[]): Promise<Deal[]> {
  if (!deals.length) return deals;

  const fields = await pb
    .collection("settings_fields")
    .getFullList<{ id: string; field_name?: string }>({
      filter: 'entity_type="deal"',
    })
    .catch(() => []);

  let budgetFieldId: string | undefined;
  let turnoverFieldId: string | undefined;
  for (const f of fields) {
    const canonical = normalizeDealFieldName(f.field_name);
    if (canonical === "budget") budgetFieldId = f.id;
    if (canonical === "turnover") turnoverFieldId = f.id;
  }
  if (!budgetFieldId && !turnoverFieldId) return deals;

  const fieldFilter = [budgetFieldId && `field_id="${budgetFieldId}"`, turnoverFieldId && `field_id="${turnoverFieldId}"`]
    .filter(Boolean)
    .join(" || ");
  if (!fieldFilter) return deals;

  const rows = await pb
    .collection("deal_field_values")
    .getFullList<FieldValueRow>({ filter: fieldFilter, batch: 500 })
    .catch(() => []);

  const budgetByDeal = new Map<string, number>();
  const turnoverByDeal = new Map<string, number>();
  for (const row of rows) {
    const dealId = String(row.deal_id || "");
    if (!dealId) continue;
    const n = parseDealNumber(row.value_number ?? row.value_text);
    if (n === null) continue;
    if (row.field_id === budgetFieldId) budgetByDeal.set(dealId, n);
    if (row.field_id === turnoverFieldId) turnoverByDeal.set(dealId, n);
  }

  return deals.map((d) => {
    const id = String(d.id || "");
    const budget = dealBudget(d) ?? (budgetByDeal.has(id) ? budgetByDeal.get(id)! : null);
    const turnover = dealTurnover(d) ?? (turnoverByDeal.has(id) ? turnoverByDeal.get(id)! : null);
    if (budget === dealBudget(d) && turnover === dealTurnover(d)) return d;
    return {
      ...d,
      ...(budget !== null ? { budget } : {}),
      ...(turnover !== null ? { turnover } : {}),
    };
  });
}
