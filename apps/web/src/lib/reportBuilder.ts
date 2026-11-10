import type { Deal } from "./types";
import { DEAL_FILTER_LABELS, type DealFilterParams } from "../ui/pages/deals/dealsFilters";

export type ReportCountMode = "current" | "entered";
export type ReportGroupBy = "" | "stage_name" | "loss_reason" | "responsible" | "product_name" | "company";

export type CustomReport = {
  id: string;
  name: string;
  source: "deals" | "companies";
  columns: string[];
  filters?: Record<string, string>;
  dateBasis?: "created" | "updated";
  rangeDays?: number;
  /** current = сейчас на этапе; entered = попали на этап/в отказ за период */
  countMode?: ReportCountMode;
  groupBy?: ReportGroupBy;
  /** PocketBase id when synced */
  pbId?: string;
};

export type ReportAggregateRow = {
  key: string;
  label: string;
  count: number;
  budgetSum: number;
};

export const REPORT_GROUP_BY_OPTIONS: Array<{ id: ReportGroupBy; label: string }> = [
  { id: "", label: "Без группировки" },
  { id: "stage_name", label: "Этап" },
  { id: "loss_reason", label: "Причина отказа" },
  { id: "responsible", label: "Ответственный" },
  { id: "product_name", label: "Продукт" },
  { id: "company", label: "Компания" },
];

export const DEFAULT_PILOT_CHECKLIST: Array<{ id: string; label: string }> = [
  { id: "tz_agreed", label: "ТЗ / требования пилота согласованы" },
  { id: "access_ready", label: "Доступы и контур выданы" },
  { id: "kickoff_done", label: "Kick-off проведён" },
  { id: "success_criteria", label: "Критерии успеха зафиксированы" },
  { id: "data_loaded", label: "Данные/интеграции подключены" },
  { id: "pilot_running", label: "Пилот запущен" },
  { id: "feedback_collected", label: "Обратная связь собрана" },
  { id: "decision_ready", label: "Решение go/no-go подготовлено" },
];

export type PilotChecklistItem = { id: string; label: string; done: boolean; note?: string };
export type PilotChecklist = { items: PilotChecklistItem[]; updated_at?: string };

export function normalizePilotChecklist(raw: unknown): PilotChecklist {
  const base = DEFAULT_PILOT_CHECKLIST.map((x) => ({ ...x, done: false }));
  if (!raw || typeof raw !== "object") return { items: base };
  const obj = raw as { items?: unknown; updated_at?: string };
  const incoming = Array.isArray(obj.items) ? obj.items : [];
  const byId = new Map<string, PilotChecklistItem>();
  for (const item of incoming) {
    if (!item || typeof item !== "object") continue;
    const row = item as Partial<PilotChecklistItem>;
    const id = String(row.id || "").trim();
    if (!id) continue;
    byId.set(id, {
      id,
      label: String(row.label || id),
      done: Boolean(row.done),
      note: row.note ? String(row.note) : undefined,
    });
  }
  const items = base.map((b) => byId.get(b.id) ?? b);
  for (const [id, row] of byId) {
    if (!items.some((x) => x.id === id)) items.push(row);
  }
  return { items, updated_at: obj.updated_at ? String(obj.updated_at) : undefined };
}

export function pilotCoverage(checklist: PilotChecklist | null | undefined) {
  const items = checklist?.items?.length ? checklist.items : normalizePilotChecklist(null).items;
  const total = items.length || 1;
  const done = items.filter((x) => x.done).length;
  return { done, total, pct: Math.round((done / total) * 100) };
}

export function summarizeReportSlice(report: CustomReport, rowCount: number): string {
  const parts: string[] = [`${rowCount} строк`];
  parts.push(report.countMode === "entered" ? "семантика: переход за период" : "семантика: текущее состояние");
  parts.push(`дата: ${report.dateBasis === "created" ? "создание" : "обновление"}`);
  if (report.rangeDays) parts.push(`${report.rangeDays} дн.`);
  if (report.groupBy) {
    const g = REPORT_GROUP_BY_OPTIONS.find((x) => x.id === report.groupBy);
    if (g) parts.push(`группа: ${g.label}`);
  }
  const filters = report.filters || {};
  const filterLabels = Object.keys(filters)
    .filter((k) => Boolean(String(filters[k] || "").trim()))
    .map((k) => DEAL_FILTER_LABELS[k as keyof DealFilterParams] || k);
  if (filterLabels.length) parts.push(`фильтры: ${filterLabels.join(", ")}`);
  return parts.join(" · ");
}

export function buildDealsDrillUrl(report: CustomReport, row?: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  const filters = { ...(report.filters || {}) };
  if (row) {
    if (report.groupBy === "stage_name" && row.stage_id) sp.set("stage", String(row.stage_id));
    if (report.groupBy === "loss_reason" && row.loss_reason) sp.set("loss_reason", String(row.loss_reason));
    if (report.groupBy === "responsible" && row.responsible_id) sp.set("owner", String(row.responsible_id));
    if (report.groupBy === "product_name" && row.product_filter_id) sp.set("product", String(row.product_filter_id));
    if (report.groupBy === "company" && row.company_id) sp.set("company", String(row.company_id));
    if (!report.groupBy && row.id) {
      // open specific deal
      return `/deals/${encodeURIComponent(String(row.id))}`;
    }
  }
  Object.entries(filters).forEach(([k, v]) => {
    if (v?.trim() && !sp.has(k === "owner" ? "owner" : k)) {
      const key = k === "owner" ? "owner" : k;
      if (!sp.has(key)) sp.set(key, v.trim());
    }
  });
  if (report.dateBasis === "created") {
    // approximate from rangeDays already applied in report; keep explicit from filter if present
  } else if (filters.updatedFrom) sp.set("updatedFrom", filters.updatedFrom);
  if (filters.from) sp.set("from", filters.from);
  if (filters.to) sp.set("to", filters.to);
  if (filters.updatedTo) sp.set("updatedTo", filters.updatedTo);
  const q = sp.toString();
  return q ? `/deals?${q}` : "/deals";
}

export function aggregateReportRows(
  rows: Array<Record<string, unknown>>,
  groupBy: ReportGroupBy,
): ReportAggregateRow[] {
  if (!groupBy) return [];
  const map = new Map<string, ReportAggregateRow>();
  for (const row of rows) {
    const label = String(row[groupBy] ?? "").trim() || "—";
    const key = label.toLowerCase();
    const budget = Number(row.budget ?? 0) || 0;
    const prev = map.get(key);
    if (prev) {
      prev.count += 1;
      prev.budgetSum += budget;
    } else {
      map.set(key, { key, label, count: 1, budgetSum: budget });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count || b.budgetSum - a.budgetSum);
}

export function dealBudgetValue(d: Partial<Deal> | Record<string, unknown>) {
  const b = Number((d as Deal).budget ?? 0);
  const t = Number((d as Deal).turnover ?? 0);
  return b || t || 0;
}

/** Normalize timeline payload.to which may be stage id or stage name. */
export function payloadStageToken(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const to = (payload as { to?: unknown }).to;
  return to == null ? "" : String(to).trim();
}

export function stageMatchesToken(stage: { id?: string; stage_name?: string } | null | undefined, token: string) {
  if (!token || !stage) return false;
  const t = token.toLowerCase();
  return String(stage.id || "").toLowerCase() === t || String(stage.stage_name || "").toLowerCase() === t;
}
