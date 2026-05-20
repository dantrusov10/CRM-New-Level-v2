import * as XLSX from "xlsx";
import { pb } from "./pb";
import { DEAL_EXPORT_COLUMNS } from "./dealImportExportFields";
import { dealFieldLabel, normalizeDealFieldName } from "./canonicalFields";
import { enrichDealsNumericFields } from "../ui/pages/deals/dealNumeric";
import { buildDealsFilter, filterDealsClient, hasClientNumericFilters } from "../ui/pages/deals/dealsFilters";
import type { Company, Deal, TimelineItem, UserSummary, FunnelStage } from "./types";

export type ExportEntity = "deal" | "company";
export type ExportFormat = "xlsx" | "csv";

export type TimelineExportFields = {
  tl_comments?: boolean;
  tl_notes?: boolean;
  tl_tasks?: boolean;
  tl_task_completed?: boolean;
  tl_task_status?: boolean;
  tl_ai?: boolean;
  tl_stage?: boolean;
  tl_system?: boolean;
  tl_limit?: number;
};

export type ExportRunConfig = {
  entity: ExportEntity;
  format: ExportFormat;
  fields: Record<string, boolean>;
  timelineFields?: TimelineExportFields;
  useCurrentFilters: boolean;
  searchParams?: URLSearchParams;
};

function exportCell(val: unknown): string {
  if (val == null || val === "") return "";
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

type DealRow = Deal & {
  expand?: {
    company_id?: Company | null;
    stage_id?: FunnelStage | null;
    responsible_id?: UserSummary | null;
  };
};

function buildDealRow(d: DealRow, fields: Record<string, boolean>): Record<string, string> {
  const company = d.expand?.company_id;
  const stage = d.expand?.stage_id;
  const resp = d.expand?.responsible_id;
  const row: Record<string, string> = {};
  if (fields.title) row["Название сделки"] = d.title ?? "";
  if (fields.company) row["Компания"] = company?.name ?? "";
  if (fields.inn) row["ИНН"] = company?.inn ?? "";
  if (fields.stage) row["Этап"] = stage?.stage_name ?? "";
  if (fields.responsible) row["Ответственный"] = resp?.full_name || resp?.email || "";
  for (const col of DEAL_EXPORT_COLUMNS) {
    if (!col.canonical || !fields[col.key]) continue;
    const canon = normalizeDealFieldName(col.canonical);
    if (!canon || ["title", "company_id", "stage_id", "responsible_id"].includes(canon)) continue;
    row[dealFieldLabel(canon)] = exportCell((d as Record<string, unknown>)[canon]);
  }
  if (fields.delivery_date) row["Поставка"] = exportCell((d as Record<string, unknown>).delivery_date);
  if (fields.expected_payment_date) row["Ожид. оплата"] = exportCell((d as Record<string, unknown>).expected_payment_date);
  if (fields.updated) row["Обновлено"] = exportCell(d.updated);
  return row;
}

function timelineCategory(action: string): string {
  const a = action.toLowerCase();
  if (a === "comment") return "comment";
  if (a === "note") return "note";
  if (a === "task_created" || a === "task_completed" || a === "task_comment") return "task";
  if (a === "stage_change") return "stage";
  if (a.startsWith("ai")) return "ai";
  return "system";
}

function includeTimelineEvent(action: string, tf: TimelineExportFields): boolean {
  const cat = timelineCategory(action);
  if (cat === "comment" && tf.tl_comments) return true;
  if (cat === "note" && tf.tl_notes) return true;
  if (cat === "task") {
    if (action === "task_completed" && tf.tl_task_completed) return true;
    if (action === "task_created" && tf.tl_tasks) return true;
    if (action === "task_comment" && tf.tl_tasks) return true;
    if (tf.tl_task_status) return true;
  }
  if (cat === "ai" && tf.tl_ai) return true;
  if (cat === "stage" && tf.tl_stage) return true;
  if (cat === "system" && tf.tl_system) return true;
  return false;
}

function hasTimelineExport(tf?: TimelineExportFields): boolean {
  if (!tf) return false;
  return Boolean(
    tf.tl_comments ||
      tf.tl_notes ||
      tf.tl_tasks ||
      tf.tl_task_completed ||
      tf.tl_task_status ||
      tf.tl_ai ||
      tf.tl_stage ||
      tf.tl_system,
  );
}

async function fetchDeals(sp?: URLSearchParams, useCurrentFilters = true): Promise<DealRow[]> {
  const filter = useCurrentFilters && sp ? buildDealsFilter(sp) : "";
  const params: Record<string, unknown> = {
    sort: "-updated",
    expand: "company_id,stage_id,responsible_id",
    batch: 200,
  };
  if (filter.trim()) params.filter = filter.trim();
  let deals = await pb.collection("deals").getFullList<DealRow>(params);
  deals = await enrichDealsNumericFields(deals);
  if (useCurrentFilters && sp && hasClientNumericFilters(sp)) {
    deals = filterDealsClient(deals, sp);
  }
  return deals;
}

async function fetchTimelineForDeals(dealIds: string[]): Promise<Map<string, TimelineItem[]>> {
  const map = new Map<string, TimelineItem[]>();
  if (!dealIds.length) return map;
  const chunks: string[][] = [];
  for (let i = 0; i < dealIds.length; i += 40) chunks.push(dealIds.slice(i, i + 40));
  for (const chunk of chunks) {
    const filter = chunk.map((id) => `deal_id="${id}"`).join(" || ");
    const items = await pb.collection("timeline").getFullList<TimelineItem>({
      filter,
      sort: "-timestamp",
      batch: 500,
    });
    for (const t of items) {
      const did = String(t.deal_id || "");
      if (!did) continue;
      const arr = map.get(did) ?? [];
      arr.push(t);
      map.set(did, arr);
    }
  }
  return map;
}

function buildTimelineRows(
  deals: DealRow[],
  timelineByDeal: Map<string, TimelineItem[]>,
  tf: TimelineExportFields,
): Record<string, string>[] {
  const limit = Math.max(1, Math.min(500, tf.tl_limit ?? 50));
  const rows: Record<string, string>[] = [];
  for (const d of deals) {
    const events = (timelineByDeal.get(d.id) ?? []).filter((t) => includeTimelineEvent(String(t.action || ""), tf));
    const slice = events.slice(0, limit);
    for (const t of slice) {
      const p = t.payload && typeof t.payload === "object" ? (t.payload as Record<string, unknown>) : {};
      rows.push({
        "ID сделки": d.id,
        "Название сделки": d.title ?? "",
        Дата: exportCell(t.timestamp || t.created),
        Тип: timelineCategory(String(t.action || "")),
        Действие: String(t.action || ""),
        Текст: String(t.comment || ""),
        "Статус задачи": exportCell(p.outcome || p.task_status || ""),
        "Срок задачи": exportCell(p.due_at || ""),
        Автор: exportCell(p.user_id || ""),
      });
    }
  }
  return rows;
}

function workbookToBlob(wb: XLSX.WorkBook): Blob {
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

function rowsToCsv(rows: Record<string, string>[]): string {
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ "": "" }]);
  return XLSX.utils.sheet_to_csv(ws);
}

export type ExportRunResult = {
  filename: string;
  blob: Blob;
  mime: string;
};

export async function runExport(config: ExportRunConfig): Promise<ExportRunResult> {
  const sp = config.searchParams;
  const tf = config.timelineFields;

  if (config.entity === "company") {
    const filter =
      config.useCurrentFilters && sp
        ? [
            sp.get("city") ? `city~"${String(sp.get("city")).replace(/"/g, '\\"')}"` : "",
            sp.get("responsible") ? `responsible_id="${String(sp.get("responsible")).replace(/"/g, '\\"')}"` : "",
          ]
            .filter(Boolean)
            .join(" && ")
        : "";
    const params: Record<string, unknown> = { sort: "name", expand: "responsible_id", batch: 200 };
    if (filter.trim()) params.filter = filter.trim();
    const companies = await pb.collection("companies").getFullList<
      Company & { expand?: { responsible_id?: UserSummary } }
    >(params);
    const rows = companies.map((c) => {
      const resp = c.expand?.responsible_id;
      const row: Record<string, string> = {};
      if (config.fields.name) row["Название компании"] = c.name ?? "";
      if (config.fields.inn) row["ИНН"] = c.inn ?? "";
      if (config.fields.city) row["Город"] = c.city ?? "";
      if (config.fields.website) row["Сайт"] = c.website ?? "";
      if (config.fields.phone) row["Телефон"] = c.phone ?? "";
      if (config.fields.email) row["Email"] = c.email ?? "";
      if (config.fields.responsible) row["Ответственный"] = resp?.full_name || resp?.email || "";
      if (config.fields.updated) row["Обновлено"] = exportCell(c.updated);
      return row;
    });
    if (config.format === "csv") {
      const csv = rowsToCsv(rows);
      return {
        filename: "companies_export.csv",
        blob: new Blob([csv], { type: "text/csv;charset=utf-8;" }),
        mime: "text/csv",
      };
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "companies");
    return { filename: "companies_export.xlsx", blob: workbookToBlob(wb), mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
  }

  const deals = await fetchDeals(sp, config.useCurrentFilters);
  const mainRows = deals.map((d) => buildDealRow(d, config.fields));
  const wb = XLSX.utils.book_new();
  const mainSheet = XLSX.utils.json_to_sheet(mainRows.length ? mainRows : [{ "": "" }]);
  XLSX.utils.book_append_sheet(wb, mainSheet, "deals");

  if (hasTimelineExport(tf)) {
    const tlMap = await fetchTimelineForDeals(deals.map((d) => d.id));
    const tlRows = buildTimelineRows(deals, tlMap, tf!);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tlRows.length ? tlRows : [{ "": "" }]), "timeline");
  }

  if (config.format === "csv") {
    const csv = rowsToCsv(mainRows);
    return { filename: "deals_export.csv", blob: new Blob([csv], { type: "text/csv;charset=utf-8;" }), mime: "text/csv" };
  }

  return { filename: "deals_export.xlsx", blob: workbookToBlob(wb), mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
}

export function downloadExportResult(result: ExportRunResult) {
  const url = URL.createObjectURL(result.blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = result.filename;
  a.click();
  URL.revokeObjectURL(url);
}
