import type { Deal } from "../../../lib/types";

export type SortDir = "asc" | "desc";

export type ParsedDealSort = {
  columnId: string;
  dir: SortDir;
};

const SERVER_SORT: Record<string, string> = {
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

const CLIENT_SORT: Record<string, (d: Deal) => string | number> = {
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

export function pocketBaseSortFromParam(sortParam: string | null | undefined): string {
  const parsed = parseDealSortParam(sortParam);
  if (!parsed) return "-updated";
  const field = SERVER_SORT[parsed.columnId];
  if (!field) return "-updated";
  return parsed.dir === "desc" ? `-${field}` : field;
}

export function needsClientSort(sortParam: string | null | undefined): boolean {
  const parsed = parseDealSortParam(sortParam);
  return Boolean(parsed && CLIENT_SORT[parsed.columnId]);
}

export function sortDealsClient(items: Deal[], sortParam: string | null | undefined): Deal[] {
  const parsed = parseDealSortParam(sortParam);
  if (!parsed) return items;
  const getter = CLIENT_SORT[parsed.columnId];
  if (!getter) return items;
  const dir = parsed.dir === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    const av = getter(a);
    const bv = getter(b);
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
    return String(av).localeCompare(String(bv), "ru") * dir;
  });
}
