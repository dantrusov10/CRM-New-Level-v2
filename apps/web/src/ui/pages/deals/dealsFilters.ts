import dayjs from "dayjs";

export const DEAL_FILTER_PARAM_KEYS = [
  "stage",
  "owner",
  "company",
  "title",
  "channel",
  "partner",
  "distributor",
  "purchase_format",
  "activity",
  "presale",
  "attraction_channel",
  "infrastructure_size",
  "budgetMin",
  "budgetMax",
  "turnoverMin",
  "turnoverMax",
  "marginMin",
  "marginMax",
  "discountMin",
  "discountMax",
  "scoreMin",
  "scoreMax",
  "endpointsMin",
  "endpointsMax",
  "from",
  "to",
  "updatedFrom",
  "updatedTo",
  "deliveryFrom",
  "deliveryTo",
  "expectedPaymentFrom",
  "expectedPaymentTo",
  "testStartFrom",
  "testEndTo",
] as const;

export type DealFilterParams = Partial<Record<(typeof DEAL_FILTER_PARAM_KEYS)[number], string>>;

function esc(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function dateGte(key: string, iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${key} >= "${dayjs(d).format("YYYY-MM-DD HH:mm:ss")}"`;
}

function dateLte(key: string, iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${key} <= "${dayjs(d).endOf("day").format("YYYY-MM-DD HH:mm:ss")}"`;
}

function numGte(key: string, v: string) {
  const n = Number(v);
  return Number.isFinite(n) ? `${key} >= ${n}` : "";
}

function numLte(key: string, v: string) {
  const n = Number(v);
  return Number.isFinite(n) ? `${key} <= ${n}` : "";
}

function contains(key: string, v: string) {
  const t = v.trim();
  return t ? `${key}~"${esc(t)}"` : "";
}

/** PocketBase filter string for deals list. */
export function buildDealsFilter(sp: URLSearchParams): string {
  const p = (k: string) => sp.get(k) ?? "";

  return [
    p("stage") ? `stage_id="${p("stage")}"` : "",
    p("owner") ? `responsible_id="${p("owner")}"` : "",
    p("company") ? `company_id="${p("company")}"` : "",
    contains("title", p("title")),
    contains("sales_channel", p("channel")),
    contains("partner", p("partner")),
    contains("distributor", p("distributor")),
    contains("purchase_format", p("purchase_format")),
    contains("activity_type", p("activity")),
    contains("presale", p("presale")),
    contains("attraction_channel", p("attraction_channel")),
    contains("infrastructure_size", p("infrastructure_size")),
    numGte("budget", p("budgetMin")),
    numLte("budget", p("budgetMax")),
    numGte("turnover", p("turnoverMin")),
    numLte("turnover", p("turnoverMax")),
    numGte("margin_percent", p("marginMin")),
    numLte("margin_percent", p("marginMax")),
    numGte("discount_percent", p("discountMin")),
    numLte("discount_percent", p("discountMax")),
    numGte("current_score", p("scoreMin")),
    numLte("current_score", p("scoreMax")),
    numGte("endpoints", p("endpointsMin")),
    numLte("endpoints", p("endpointsMax")),
    dateGte("created", p("from")),
    dateLte("created", p("to")),
    dateGte("updated", p("updatedFrom")),
    dateLte("updated", p("updatedTo")),
    dateGte("delivery_date", p("deliveryFrom")),
    dateLte("delivery_date", p("deliveryTo")),
    dateGte("expected_payment_date", p("expectedPaymentFrom")),
    dateLte("expected_payment_date", p("expectedPaymentTo")),
    dateGte("test_start", p("testStartFrom")),
    dateLte("test_end", p("testEndTo")),
  ]
    .filter(Boolean)
    .join(" && ");
}

export function countActiveDealFilters(sp: URLSearchParams): number {
  return DEAL_FILTER_PARAM_KEYS.filter((k) => Boolean(sp.get(k)?.trim())).length;
}

export function dealFilterParamsFromSearchParams(sp: URLSearchParams): DealFilterParams {
  const out: DealFilterParams = {};
  for (const k of DEAL_FILTER_PARAM_KEYS) {
    const v = sp.get(k);
    if (v?.trim()) out[k] = v;
  }
  return out;
}

export function applyDealFiltersToSearchParams(sp: URLSearchParams, values: DealFilterParams) {
  for (const k of DEAL_FILTER_PARAM_KEYS) sp.delete(k);
  Object.entries(values).forEach(([k, v]) => {
    if (v?.trim()) sp.set(k, v.trim());
  });
  sp.set("page", "1");
}
