import type { Deal } from "../../../lib/types";

export type SortDir = "asc" | "desc";

export type ParsedDealSort = {
  columnId: string;
  dir: SortDir;
};

const SERVER_FIELD: Record<string, keyof Deal | string> = {
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

const RELATION_SORT: Record<string, (d: Deal) => string> = {
  company: (d) => (d.expand?.company_id?.name ?? "").toLocaleLowerCase("ru"),
  owner: (d) => (d.expand?.responsible_id?.full_name ?? d.expand?.responsible_id?.email ?? "").toLocaleLowerCase("ru"),
  stage: (d) => (d.expand?.stage_id?.stage_name ?? "").toLocaleLowerCase("ru"),
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

export function hasCustomDealSort(sortParam: string | null | undefined): boolean {
  return parseDealSortParam(sortParam) !== null;
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

  const an = Number(av);
  const bn = Number(bv);
  if (Number.isFinite(an) && Number.isFinite(bn)) return (an - bn) * dir;

  const ad = Date.parse(String(av));
  const bd = Date.parse(String(bv));
  if (Number.isFinite(ad) && Number.isFinite(bd)) return (ad - bd) * dir;

  return String(av).localeCompare(String(bv), "ru", { sensitivity: "base" }) * dir;
}

/** Sort entire filtered dataset (all pages) before pagination. */
export function sortDealsGlobal(items: Deal[], sortParam: string | null | undefined): Deal[] {
  const parsed = parseDealSortParam(sortParam);
  if (!parsed) return items;

  const dir = parsed.dir === "asc" ? 1 : -1;
  const relationGetter = RELATION_SORT[parsed.columnId];
  const field = SERVER_FIELD[parsed.columnId];

  const sorted = [...items].sort((a, b) => {
    let cmp = 0;
    if (relationGetter) {
      cmp = compareValues(relationGetter(a), relationGetter(b), dir);
    } else if (field) {
      cmp = compareValues((a as Record<string, unknown>)[field], (b as Record<string, unknown>)[field], dir);
    }
    if (cmp !== 0) return cmp;
    const au = Date.parse(String(a.updated || a.created || ""));
    const bu = Date.parse(String(b.updated || b.created || ""));
    return (bu - au) || String(a.id).localeCompare(String(b.id));
  });

  return sorted;
}

/** @deprecated use sortDealsGlobal */
export function needsClientSort(sortParam: string | null | undefined): boolean {
  return hasCustomDealSort(sortParam);
}

/** @deprecated use sortDealsGlobal */
export function sortDealsClient(items: Deal[], sortParam: string | null | undefined): Deal[] {
  return sortDealsGlobal(items, sortParam);
}

/** @deprecated */
export function pocketBaseSortFromParam(sortParam: string | null | undefined): string {
  return hasCustomDealSort(sortParam) ? "-updated" : (sortParam?.trim() || "-updated");
}
