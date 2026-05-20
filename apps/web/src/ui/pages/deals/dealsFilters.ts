import dayjs from "dayjs";
import type { Deal } from "../../../lib/types";
import { dealBudget, dealTurnover, parseDealNumber } from "./dealNumeric";

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

function parseFilterNum(v: string): number | null {
  const cleaned = String(v || "").trim().replace(/\s/g, "").replace(",", ".");
  if (!cleaned || cleaned === "безлимита") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function numGte(key: string, v: string) {
  const n = parseFilterNum(v);
  return n !== null ? `${key} >= ${n}` : "";
}

function numLte(key: string, v: string) {
  const n = parseFilterNum(v);
  return n !== null ? `${key} <= ${n}` : "";
}

/** Числовые фильтры — в памяти (корректный парсинг, в т.ч. пустые значения). */
export const CLIENT_NUMERIC_FILTER_KEYS = [
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
] as const;

export function hasClientNumericFilters(sp: URLSearchParams): boolean {
  return CLIENT_NUMERIC_FILTER_KEYS.some((k) => parseFilterNum(sp.get(k) ?? "") !== null);
}

export function filterDealsClient(items: Deal[], sp: URLSearchParams): Deal[] {
  const budgetMin = parseFilterNum(sp.get("budgetMin") ?? "");
  const budgetMax = parseFilterNum(sp.get("budgetMax") ?? "");
  const turnoverMin = parseFilterNum(sp.get("turnoverMin") ?? "");
  const turnoverMax = parseFilterNum(sp.get("turnoverMax") ?? "");
  const marginMin = parseFilterNum(sp.get("marginMin") ?? "");
  const marginMax = parseFilterNum(sp.get("marginMax") ?? "");
  const discountMin = parseFilterNum(sp.get("discountMin") ?? "");
  const discountMax = parseFilterNum(sp.get("discountMax") ?? "");
  const scoreMin = parseFilterNum(sp.get("scoreMin") ?? "");
  const scoreMax = parseFilterNum(sp.get("scoreMax") ?? "");
  const endpointsMin = parseFilterNum(sp.get("endpointsMin") ?? "");
  const endpointsMax = parseFilterNum(sp.get("endpointsMax") ?? "");

  if (
    budgetMin === null &&
    budgetMax === null &&
    turnoverMin === null &&
    turnoverMax === null &&
    marginMin === null &&
    marginMax === null &&
    discountMin === null &&
    discountMax === null &&
    scoreMin === null &&
    scoreMax === null &&
    endpointsMin === null &&
    endpointsMax === null
  ) {
    return items;
  }

  return items.filter((d) => {
    const budget = dealBudget(d);
    const turnover = dealTurnover(d);
    const margin = parseDealNumber(d.margin_percent);
    const discount = parseDealNumber(d.discount_percent);
    const score = parseDealNumber(d.current_score);
    const endpoints = parseDealNumber(d.endpoints);

    if (budgetMin !== null && (budget ?? -Infinity) < budgetMin) return false;
    if (budgetMax !== null && (budget ?? Infinity) > budgetMax) return false;
    if (turnoverMin !== null && (turnover ?? -Infinity) < turnoverMin) return false;
    if (turnoverMax !== null && (turnover ?? Infinity) > turnoverMax) return false;
    if (marginMin !== null && (margin ?? -Infinity) < marginMin) return false;
    if (marginMax !== null && (margin ?? Infinity) > marginMax) return false;
    if (discountMin !== null && (discount ?? -Infinity) < discountMin) return false;
    if (discountMax !== null && (discount ?? Infinity) > discountMax) return false;
    if (scoreMin !== null && (score ?? -Infinity) < scoreMin) return false;
    if (scoreMax !== null && (score ?? Infinity) > scoreMax) return false;
    if (endpointsMin !== null && (endpoints ?? -Infinity) < endpointsMin) return false;
    if (endpointsMax !== null && (endpoints ?? Infinity) > endpointsMax) return false;
    return true;
  });
}

function contains(key: string, v: string) {
  const t = v.trim();
  return t ? `${key}~"${esc(t)}"` : "";
}

/** PocketBase filter (без числовых полей — они через filterDealsClient). */
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
