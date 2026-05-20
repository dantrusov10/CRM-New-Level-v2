import type { Deal } from "../../../lib/types";
import { dealBudget, dealTurnover, parseDealNumber } from "./dealNumeric";

export type SortDir = "asc" | "desc";

export type ParsedDealSort = {
  columnId: string;
  dir: SortDir;
};

/** Поля, которые PocketBase сортирует на сервере (все страницы). */
const PB_SORT_FIELD: Record<string, string> = {
  title: "title",
  budget: "budget",
  turnover: "turnover",
  margin_percent: "margin_percent",
  discount_percent: "discount_percent",
  sales_channel: "sales_channel",
  partner: "partner",
  distributor: "distributor",
  purchase_format: "purchase_format",
  activity_type: "activity_type",
  endpoints: "endpoints",
  infrastructure_size: "infrastructure_size",
  attraction_channel: "attraction_channel",
  current_score: "current_score",
  created: "created",
  updated: "updated",
  delivery_date: "delivery_date",
  expected_payment_date: "expected_payment_date",
};

/** Только эти колонки — сортировка в памяти по expand (вся выборка). */
const RELATION_SORT: Record<string, (d: Deal) => string> = {
  company: (d) => (d.expand?.company_id?.name ?? "").toLocaleLowerCase("ru"),
  owner: (d) => (d.expand?.responsible_id?.full_name ?? d.expand?.responsible_id?.email ?? "").toLocaleLowerCase("ru"),
  stage: (d) => (d.expand?.stage_id?.stage_name ?? "").toLocaleLowerCase("ru"),
};

const NUMERIC_SORT_GETTER: Record<string, (d: Deal) => number | null> = {
  budget: dealBudget,
  turnover: dealTurnover,
};

export function isSortableColumn(columnId: string) {
  return columnId !== "select" && columnId !== "project_map_link" && columnId !== "kaiten_link";
}

export function parseDealSortParam(sortParam: string | null | undefined): ParsedDealSort | null {
  if (!sortParam?.trim()) return null;
  const raw = sortParam.trim();
  if (raw === "-updated") return null;
  const desc = raw.startsWith("-");
  const columnId = desc ? raw.slice(1) : raw;
  if (!isSortableColumn(columnId)) return null;
  return { columnId, dir: desc ? "desc" : "asc" };
}

/** Сортировка в памяти по всей выборке: связи и числовые поля (корректный парсинг). */
export function needsRelationSort(sortParam: string | null | undefined): boolean {
  const parsed = parseDealSortParam(sortParam);
  if (!parsed) return false;
  if (RELATION_SORT[parsed.columnId]) return true;
  return Boolean(NUMERIC_SORT_GETTER[parsed.columnId]);
}

export function pocketBaseSortFromParam(sortParam: string | null | undefined): string {
  const parsed = parseDealSortParam(sortParam);
  if (!parsed) return sortParam?.trim() || "-updated";
  const field = PB_SORT_FIELD[parsed.columnId];
  if (!field) return "-updated";
  return parsed.dir === "desc" ? `-${field}` : field;
}

export function dealSortToParam(columnId: string, dir: SortDir): string {
  return dir === "desc" ? `-${columnId}` : columnId;
}

export function nextSortParam(current: string | null | undefined, columnId: string): string {
  if (!isSortableColumn(columnId)) return current?.trim() || "-updated";
  const parsed = parseDealSortParam(current);
  if (parsed?.columnId !== columnId) return dealSortToParam(columnId, "asc");
  if (parsed.dir === "asc") return dealSortToParam(columnId, "desc");
  return "-updated";
}

function compareValues(av: unknown, bv: unknown, dir: number): number {
  const aEmpty = av === null || av === undefined || av === "";
  const bEmpty = bv === null || bv === undefined || bv === "";
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;

  const an = typeof av === "number" ? av : parseDealNumber(av);
  const bn = typeof bv === "number" ? bv : parseDealNumber(bv);
  if (an !== null && bn !== null) return (an - bn) * dir;

  const ad = Date.parse(String(av));
  const bd = Date.parse(String(bv));
  if (Number.isFinite(ad) && Number.isFinite(bd)) return (ad - bd) * dir;

  return String(av).localeCompare(String(bv), "ru", { sensitivity: "base" }) * dir;
}

function valueForSort(deal: Deal, columnId: string): unknown {
  const numGetter = NUMERIC_SORT_GETTER[columnId];
  if (numGetter) return numGetter(deal);
  const field = PB_SORT_FIELD[columnId];
  if (field) return (deal as Record<string, unknown>)[field];
  return null;
}

/** Сортировка всей выборки в памяти (компания / ответственный / этап). */
export function sortDealsGlobal(items: Deal[], sortParam: string | null | undefined): Deal[] {
  const parsed = parseDealSortParam(sortParam);
  if (!parsed) return items;

  const dir = parsed.dir === "asc" ? 1 : -1;
  const relationGetter = RELATION_SORT[parsed.columnId];

  return [...items].sort((a, b) => {
    let cmp = 0;
    if (relationGetter) {
      cmp = compareValues(relationGetter(a), relationGetter(b), dir);
    } else {
      cmp = compareValues(valueForSort(a, parsed.columnId), valueForSort(b, parsed.columnId), dir);
    }
    if (cmp !== 0) return cmp;
    const au = Date.parse(String(a.updated || a.created || ""));
    const bu = Date.parse(String(b.updated || b.created || ""));
    return bu - au || String(a.id).localeCompare(String(b.id));
  });
}
