import React from "react";
import { TrendingUp, CircleDot, Percent, Clock, Settings2, BarChart3, Download, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, DragOverlay } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, arrayMove, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDeals, useFunnelStages, useUsers, useCompanies } from "../data/hooks";
import type { Deal, FunnelStage, UserSummary, Company } from "../../lib/types";
import { Button } from "../components/Button";
import { Modal } from "../components/Modal";
import { pb } from "../../lib/pb";
import { analyzeAdminDashboardWithAi } from "../../lib/aiGateway";
import { useAuth } from "../../app/AuthProvider";

function money(n: number) {
  if (!Number.isFinite(n)) return "0";
  return Math.round(n).toLocaleString("ru-RU");
}

function daysBetween(a: Date, b: Date) {
  const ms = Math.abs(a.getTime() - b.getTime());
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function MiniBars({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-1 h-14">
      {values.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-md"
          style={{
            height: `${Math.round((v / max) * 100)}%`,
            background: "linear-gradient(180deg, rgba(87,183,255,0.95), rgba(44,158,255,0.38))",
            border: "1px solid rgba(255,255,255,0.10)",
          }}
        />
      ))}
    </div>
  );
}

function Donut({ value }: { value: number }) {
  const size = 90;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, value));
  const dash = (clamped / 100) * c;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke="rgba(255,255,255,0.12)"
        strokeWidth={stroke}
        fill="transparent"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke="rgba(87,183,255,0.95)"
        strokeWidth={stroke}
        strokeLinecap="round"
        fill="transparent"
        strokeDasharray={`${dash} ${c - dash}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="rgba(255,255,255,0.92)"
        fontSize="16"
        fontWeight="800"
      >
        {Math.round(clamped)}%
      </text>
    </svg>
  );
}

function SortableReportItem({
  id,
  editMode,
  colSpan,
  rowSpan,
  isDropAllowed,
  isDropTarget,
  onResizeStart,
  children,
}: {
  id: string;
  editMode: boolean;
  colSpan: number;
  rowSpan: number;
  isDropAllowed: boolean;
  isDropTarget: boolean;
  onResizeStart: (edge: "left" | "right" | "top" | "bottom", e: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: !editMode });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    gridColumn: `span ${Math.max(1, Math.min(24, colSpan || 8))}`,
    gridRow: `span ${Math.max(4, rowSpan || 8)}`,
    zIndex: isDragging ? 30 : 1,
  };
  const glowClass = editMode && isDropTarget
    ? isDropAllowed
      ? "ring-2 ring-[rgba(0,216,122,0.95)] shadow-[0_0_24px_rgba(0,216,122,0.65)]"
      : "ring-2 ring-[rgba(239,68,68,0.95)] shadow-[0_0_24px_rgba(239,68,68,0.65)]"
    : "";
  return (
    <div ref={setNodeRef} style={style} className={`relative ${glowClass}`}>
      <div className={isDragging ? "opacity-70" : ""} {...attributes} {...listeners}>
        {children}
      </div>
      {editMode ? (
        <>
          <button className="absolute right-0 top-0 h-full w-[3px] cursor-ew-resize bg-[rgba(51,215,255,0.6)]" onMouseDown={(e) => onResizeStart("right", e)} title="Изменить ширину" />
          <button className="absolute left-0 top-0 h-full w-[3px] cursor-ew-resize bg-[rgba(51,215,255,0.6)]" onMouseDown={(e) => onResizeStart("left", e)} title="Изменить ширину" />
          <button className="absolute left-0 top-0 h-[3px] w-full cursor-ns-resize bg-[rgba(51,215,255,0.6)]" onMouseDown={(e) => onResizeStart("top", e)} title="Изменить высоту" />
          <button className="absolute left-0 bottom-0 h-[3px] w-full cursor-ns-resize bg-[rgba(51,215,255,0.6)]" onMouseDown={(e) => onResizeStart("bottom", e)} title="Изменить высоту" />
        </>
      ) : null}
    </div>
  );
}

const StatCard = ({
  title,
  value,
  icon: Icon,
  hint,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  hint?: string;
}) => (
  <div className="ui-card p-3.5 neon-accent">
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-xs text-text2 font-semibold">{title}</div>
        <div className="mt-1 text-xl font-extrabold text-text">{value}</div>
        {hint ? <div className="mt-1 text-xs text-text2">{hint}</div> : null}
      </div>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center border border-[rgba(51,215,255,0.45)] bg-[rgba(51,215,255,0.12)] shadow-[0_0_16px_rgba(51,215,255,0.22)]">
        <Icon size={18} className="text-text" />
      </div>
    </div>
  </div>
);

function dealAmount(d: Partial<Deal>) {
  const b = Number(d?.budget ?? 0);
  const t = Number(d?.turnover ?? 0);
  return b || t || 0;
}

export function DashboardPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const stagesQ = useFunnelStages();
  const dealsQ = useDeals(); // uses PB full list (batch) in hooks
  const usersQ = useUsers();
  const companiesQ = useCompanies();

  type WidgetFilters = {
    rangeDays: number;
    stageId?: string;
    ownerId?: string;
    channel?: string;
    budgetMin?: number;
    budgetMax?: number;
    scoreMin?: number;
    scoreMax?: number;
  };

  type WidgetId = "statCards" | "dynamics" | "winRate" | "funnel" | "topManagers" | "insights" | "budgetByStage";

  type WidgetCfg = {
    enabled: boolean;
    syncWithGlobal: boolean;
    filters: WidgetFilters;
    visual?: "cockpit" | "classic"; // used by some widgets
    span?: number;
    rowSpan?: number;
  };

  type DashCfg = {
    dashboardVisual: "cockpit" | "classic";
    widgets: Record<WidgetId, WidgetCfg>;
    widgetOrder: WidgetId[];
  };

  const DEFAULT_WIDGET_FILTERS: WidgetFilters = {
    rangeDays: 30,
    stageId: "",
    ownerId: "",
    channel: "",
    budgetMin: undefined,
    budgetMax: undefined,
    scoreMin: undefined,
    scoreMax: undefined,
  };

  const DEFAULT_CFG: DashCfg = {
    dashboardVisual: "cockpit",
    widgets: {
      statCards: { enabled: true, syncWithGlobal: true, filters: { ...DEFAULT_WIDGET_FILTERS }, span: 24, rowSpan: 8 },
      dynamics: { enabled: true, syncWithGlobal: true, filters: { ...DEFAULT_WIDGET_FILTERS }, span: 8, rowSpan: 8 },
      winRate: { enabled: true, syncWithGlobal: true, filters: { ...DEFAULT_WIDGET_FILTERS }, span: 8, rowSpan: 8 },
      funnel: { enabled: true, syncWithGlobal: true, filters: { ...DEFAULT_WIDGET_FILTERS }, visual: "cockpit", span: 8, rowSpan: 12 },
      topManagers: { enabled: true, syncWithGlobal: true, filters: { ...DEFAULT_WIDGET_FILTERS }, span: 8, rowSpan: 12 },
      insights: { enabled: true, syncWithGlobal: true, filters: { ...DEFAULT_WIDGET_FILTERS }, span: 16, rowSpan: 10 },
      budgetByStage: { enabled: true, syncWithGlobal: true, filters: { ...DEFAULT_WIDGET_FILTERS }, span: 8, rowSpan: 10 },
    },
    widgetOrder: ["insights", "statCards", "dynamics", "winRate", "topManagers", "funnel", "budgetByStage"],
  };

  function loadCfg(): DashCfg {
    try {
      const raw = localStorage.getItem("nwlvl_dashboard_cfg");
      if (!raw) return DEFAULT_CFG;
      const parsed = JSON.parse(raw);
      // merge widgets deeply so we can add new widgets without breaking old storage
      const merged: DashCfg = {
        ...DEFAULT_CFG,
        ...parsed,
        widgets: { ...DEFAULT_CFG.widgets },
      };
      const pw = parsed?.widgets ?? {};
      for (const k of Object.keys(DEFAULT_CFG.widgets) as WidgetId[]) {
        const src = pw?.[k] ?? {};
        merged.widgets[k] = {
          ...DEFAULT_CFG.widgets[k],
          ...src,
          filters: { ...DEFAULT_CFG.widgets[k].filters, ...(src?.filters ?? {}) },
          span:
            typeof src?.span === "number"
              ? src.span <= 3
                ? src.span * 8
                : src.span <= 12
                  ? src.span * 2
                  : src.span
              : DEFAULT_CFG.widgets[k].span,
        };
      }
      merged.widgetOrder = Array.isArray(parsed?.widgetOrder)
        ? (parsed.widgetOrder.filter((x: unknown): x is WidgetId => typeof x === "string" && x in DEFAULT_CFG.widgets) as WidgetId[])
        : [...DEFAULT_CFG.widgetOrder];
      for (const id of DEFAULT_CFG.widgetOrder) {
        if (!merged.widgetOrder.includes(id)) merged.widgetOrder.push(id);
      }
      return merged;
    } catch {
      return DEFAULT_CFG;
    }
  }

  const [cfg, setCfg] = React.useState<DashCfg>(() => loadCfg());
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [settingsTarget, setSettingsTarget] = React.useState<WidgetId>("insights");
  const [layoutEditMode, setLayoutEditMode] = React.useState(false);
  const [showScoringWelcome, setShowScoringWelcome] = React.useState(false);
  const [scoringRecordId, setScoringRecordId] = React.useState("");
  const [aiSummaryLoading, setAiSummaryLoading] = React.useState(false);
  const [aiSummaryError, setAiSummaryError] = React.useState("");
  const [aiSummaryText, setAiSummaryText] = React.useState("");
  const [globalFilters, setGlobalFilters] = React.useState<WidgetFilters>({
    rangeDays: 30,
    stageId: "",
    ownerId: "",
    channel: "",
    budgetMin: undefined,
    budgetMax: undefined,
    scoreMin: undefined,
    scoreMax: undefined,
  });
  const [savedViews, setSavedViews] = React.useState<Array<{ id: string; name: string; globalFilters: WidgetFilters; cfg: DashCfg }>>([]);
  const [activeViewId, setActiveViewId] = React.useState("");
  const [customReports, setCustomReports] = React.useState<Array<{ id: string; name: string; source: "deals" | "companies"; columns: string[] }>>([]);
  const [customSource, setCustomSource] = React.useState<"deals" | "companies">("deals");
  const [customName, setCustomName] = React.useState("Мой отчет");
  const [customColumns, setCustomColumns] = React.useState<string[]>(["title", "budget", "responsible"]);
  const [customSearch, setCustomSearch] = React.useState("");
  const [customBuilderOpen, setCustomBuilderOpen] = React.useState(false);
  const [controlsCollapsed, setControlsCollapsed] = React.useState(false);
  const [resizeState, setResizeState] = React.useState<{
    id: WidgetId;
    edge: "left" | "right" | "top" | "bottom";
    startX: number;
    startY: number;
    startSpan: number;
    startRowSpan: number;
  } | null>(null);
  const [draggingWidgetId, setDraggingWidgetId] = React.useState<WidgetId | null>(null);
  const [overWidgetId, setOverWidgetId] = React.useState<WidgetId | null>(null);
  const reportsGridRef = React.useRef<HTMLDivElement | null>(null);
  const userRole = String(user?.role_name || user?.role || "").toLowerCase();
  const isAdmin = /admin|founder/.test(userRole);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  React.useEffect(() => {
    try {
      localStorage.setItem("nwlvl_dashboard_cfg", JSON.stringify(cfg));
    } catch {}
  }, [cfg]);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem("nwlvl_dashboard_views");
      const parsed = raw ? JSON.parse(raw) : [];
      setSavedViews(Array.isArray(parsed) ? parsed : []);
    } catch {
      setSavedViews([]);
    }
  }, []);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem("nwlvl_dashboard_custom_reports");
      const parsed = raw ? JSON.parse(raw) : [];
      setCustomReports(Array.isArray(parsed) ? parsed : []);
    } catch {
      setCustomReports([]);
    }
  }, []);

  React.useEffect(() => {
    setCfg((prev) => {
      const next = { ...prev, widgets: { ...prev.widgets } };
      for (const wid of Object.keys(prev.widgets) as WidgetId[]) {
        if (!prev.widgets[wid].syncWithGlobal) continue;
        next.widgets[wid] = {
          ...prev.widgets[wid],
          filters: {
            ...prev.widgets[wid].filters,
            rangeDays: globalFilters.rangeDays,
            stageId: globalFilters.stageId,
            ownerId: globalFilters.ownerId,
            channel: globalFilters.channel,
          },
        };
      }
      return next;
    });
  }, [globalFilters.rangeDays, globalFilters.stageId, globalFilters.ownerId, globalFilters.channel]);

  React.useEffect(() => {
    let ignore = false;
    async function ensureScoringModel() {
      try {
        const founderPromptList = await pb.collection("semantic_packs").getList(1, 1, {
          filter: 'type="dashboard" && model="founder_dashboard_brief_v1"',
          sort: "-created",
        });
        if (!founderPromptList.items[0]) {
          await pb.collection("semantic_packs").create({
            type: "dashboard",
            model: "founder_dashboard_brief_v1",
            language: "ru",
            base_text:
              "Ты стратегический AI-советник founder/admin CRM. На вход получаешь метрики воронки, дельты периода, узкие места и приоритетные сделки. Дай короткий управленческий вывод: 1) что просело, 2) почему, 3) что делать за 24 часа и за 72 часа, 4) какие риски квартала требуют решения. Пиши только на русском, без JSON и технических полей.",
            variants: {
              purpose: "founder_dashboard_brief",
              version: "v1",
              output_format: "executive_text",
            },
          });
        }

        const list = await pb.collection("semantic_packs").getList(1, 1, {
          filter: 'type="deal_scoring_model" && model="deal_scoring_model_v1"',
          sort: "-created",
        });
        const item = list.items[0] as { id: string; variants?: unknown } | undefined;
        if (!item) {
          const created = await pb.collection("semantic_packs").create({
            type: "deal_scoring_model",
            model: "deal_scoring_model_v1",
            language: "ru",
            base_text: "Tenant scoring factors for deterministic deal probability",
            variants: {
              version: "v1",
              recommended: true,
              acknowledged: false,
              factors: [
                { code: "stage_progress", name: "Прогресс этапа", weight: 22, enabled: true },
                { code: "decision_maker_coverage", name: "Покрытие ЛПР/ЛВР", weight: 18, enabled: true },
                { code: "activity_freshness", name: "Свежесть активности", weight: 14, enabled: true },
                { code: "budget_clarity", name: "Определенность бюджета", weight: 14, enabled: true },
                { code: "pilot_status", name: "Статус пилота/пресейла", weight: 12, enabled: true },
                { code: "competition_pressure", name: "Конкурентное давление", weight: 10, enabled: true },
                { code: "data_completeness", name: "Полнота данных сделки", weight: 10, enabled: true },
              ],
            },
          });
          if (!ignore) {
            setScoringRecordId((created as { id: string }).id);
            setShowScoringWelcome(true);
          }
          return;
        }
        const variants = item.variants && typeof item.variants === "object" ? (item.variants as Record<string, unknown>) : {};
        if (!ignore) {
          setScoringRecordId(item.id);
          if (variants.acknowledged !== true) setShowScoringWelcome(true);
        }
      } catch {
        // no-op
      }
    }
    ensureScoringModel();
    return () => {
      ignore = true;
    };
  }, []);

  async function acknowledgeScoringModel() {
    if (!scoringRecordId) {
      setShowScoringWelcome(false);
      return;
    }
    try {
      const rec = (await pb.collection("semantic_packs").getOne(scoringRecordId)) as { variants?: unknown };
      const variants = rec.variants && typeof rec.variants === "object" ? (rec.variants as Record<string, unknown>) : {};
      await pb.collection("semantic_packs").update(scoringRecordId, {
        variants: { ...variants, acknowledged: true },
      });
    } catch {
      // no-op
    }
    setShowScoringWelcome(false);
  }

  const stages = stagesQ.data ?? [];
  const deals = dealsQ.data ?? [];

  const now = new Date();

  function applyWidgetFilters(input: Deal[], f: WidgetFilters) {
    let arr = input ?? [];
    const from = new Date(now.getTime() - (Number(f.rangeDays) || 30) * 24 * 60 * 60 * 1000);

    // time range by created
    if (f.rangeDays && f.rangeDays > 0) {
      arr = arr.filter((d) => {
        const c = d?.created ? new Date(d.created) : null;
        return c && c >= from;
      });
    }
    if (f.stageId) arr = arr.filter((d) => (d.stage_id ?? d.expand?.stage_id?.id) === f.stageId);
    if (f.ownerId) arr = arr.filter((d) => (d.responsible_id ?? d.expand?.responsible_id?.id) === f.ownerId);
    if (f.channel) arr = arr.filter((d) => String(d.sales_channel ?? "") === String(f.channel));
    if (typeof f.budgetMin === "number") arr = arr.filter((d) => Number(d?.budget ?? 0) >= f.budgetMin!);
    if (typeof f.budgetMax === "number") arr = arr.filter((d) => Number(d?.budget ?? 0) <= f.budgetMax!);
    if (typeof f.scoreMin === "number") arr = arr.filter((d) => Number(d?.current_score ?? 0) >= f.scoreMin!);
    if (typeof f.scoreMax === "number") arr = arr.filter((d) => Number(d?.current_score ?? 0) <= f.scoreMax!);
    return { arr, from };
  }

  function drillToDeals(filters: WidgetFilters & { stageId?: string }) {
    // IMPORTANT: deals page supports PB server-side filters only.
    // We pass only fields that реально существуют в коллекции deals.
    const sp = new URLSearchParams();
    if (filters.stageId) sp.set("stage", String(filters.stageId));
    if (filters.ownerId) sp.set("owner", String(filters.ownerId));
    if (filters.channel) sp.set("channel", String(filters.channel));
    if (typeof filters.budgetMin === "number") sp.set("budgetMin", String(filters.budgetMin));
    if (typeof filters.budgetMax === "number") sp.set("budgetMax", String(filters.budgetMax));
    if (typeof filters.scoreMin === "number") sp.set("scoreMin", String(filters.scoreMin));
    if (typeof filters.scoreMax === "number") sp.set("scoreMax", String(filters.scoreMax));
    // time range as "from" (YYYY-MM-DD)
    const from = new Date(now.getTime() - (Number(filters.rangeDays) || 30) * 24 * 60 * 60 * 1000);
    sp.set("from", from.toISOString());
    nav(`/deals?${sp.toString()}`);
  }

  function computeStats(list: Deal[]) {
    const all = list ?? [];
    const pipeline = all.reduce((acc, d) => acc + dealAmount(d), 0);
    const weighted = all.reduce((acc, d) => {
      const score = Number(d?.current_score ?? 0);
      const w = score > 0 ? score / 100 : 0;
      return acc + dealAmount(d) * w;
    }, 0);

    const cycleDaysArr = all
      .map((d) => {
        const c = d?.created ? new Date(d.created) : null;
        const u = d?.updated ? new Date(d.updated) : null;
        if (!c || !u) return null;
        return daysBetween(c, u);
      })
      .filter((x) => typeof x === "number") as number[];
    const cycle = cycleDaysArr.length ? Math.round(cycleDaysArr.reduce((a, b) => a + b, 0) / cycleDaysArr.length) : 0;

    const stale = all.filter((d) => {
      const u = d?.updated ? new Date(d.updated) : null;
      if (!u) return false;
      return daysBetween(now, u) >= 7;
    });
    const noBudget = all.filter((d) => !Number.isFinite(Number(d?.budget)) || Number(d?.budget) <= 0);
    const noCompany = all.filter((d) => !(d?.company_id ?? d?.expand?.company_id?.id));

    return {
      pipeline,
      weighted,
      dealsCount: all.length,
      cycle,
      riskStale: stale.length,
      riskNoBudget: noBudget.length,
      riskNoCompany: noCompany.length,
    };
  }

  function computeDynamics(list: Deal[]) {
    const all = list ?? [];
    const weeks = 8;
    const buckets = Array.from({ length: weeks }, () => 0);
    const start = new Date(now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000);
    for (const d of all) {
      const c = d?.created ? new Date(d.created) : null;
      if (!c || c < start) continue;
      const diffDays = Math.floor((c.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      const idx = Math.min(weeks - 1, Math.max(0, Math.floor(diffDays / 7)));
      buckets[idx] += 1;
    }
    return buckets;
  }

  // WinRate — вариант 2: won / (won + lost) среди финальных сделок за период.
  function computeWinRateVariant2(list: Deal[], from: Date) {
    const stageById = new Map<string, FunnelStage>();
    stages.forEach((stage) => stageById.set(String(stage.id), stage));

    const classifyFinal = (stage?: FunnelStage): "won" | "lost" | "none" => {
      if (!stage) return "none";
      const ft = String(stage?.final_type ?? "").toLowerCase();
      if (ft === "won" || ft === "win") return "won";
      if (ft === "lost" || ft === "lose") return "lost";

      if (!stage?.is_final) return "none";
      const name = String(stage?.stage_name ?? "").toLowerCase();
      if (/(won|выиг|успех|закрыто успешно|подписан)/.test(name)) return "won";
      if (/(lost|проиг|отказ|потер|нецелес|закрыто неуспешно)/.test(name)) return "lost";
      // финал есть, но тип не понятен
      return "none";
    };

    let won = 0;
    let lost = 0;
    for (const d of list ?? []) {
      const sid = String(d.stage_id ?? d.expand?.stage_id?.id ?? "");
      const st = stageById.get(sid) ?? d.expand?.stage_id;
      const t = classifyFinal(st);
      if (t === "none") continue;

      // считаем по updated (в финал обычно переводят обновлением)
      const u = d?.updated ? new Date(d.updated) : null;
      if (!u || u < from) continue;
      if (t === "won") won += 1;
      if (t === "lost") lost += 1;
    }
    const denom = won + lost;
    return {
      won,
      lost,
      rate: denom ? (won / denom) * 100 : 0,
    };
  }

  function stageTable(list: Deal[]) {
    const by: Record<string, { name: string; count: number; sum: number }> = {};
    for (const s of stages) {
      by[String(s.id)] = { name: String(s.stage_name ?? "Этап"), count: 0, sum: 0 };
    }
    for (const d of list ?? []) {
      const sid = String(d.stage_id ?? d.expand?.stage_id?.id ?? "");
      if (!sid || !by[sid]) continue;
      by[sid].count += 1;
      by[sid].sum += dealAmount(d);
    }
    return Object.entries(by)
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.sum - a.sum);
  }

  function topManagersTable(list: Deal[]) {
    const m: Record<string, { id: string; name: string; deals: number; pipeline: number }> = {};
    for (const d of list ?? []) {
      const rid = String(d.responsible_id ?? d.expand?.responsible_id?.id ?? "");
      if (!rid) continue;
      const name = d.expand?.responsible_id?.full_name || d.expand?.responsible_id?.name || d.expand?.responsible_id?.email || "Менеджер";
      if (!m[rid]) m[rid] = { id: rid, name, deals: 0, pipeline: 0 };
      m[rid].deals += 1;
      m[rid].pipeline += dealAmount(d);
    }
    return Object.values(m)
      .sort((a, b) => b.pipeline - a.pipeline)
      .slice(0, 5);
  }

  function insightsFromStats(s: ReturnType<typeof computeStats>) {
    const items: { title: string; desc: string }[] = [];
    if (s.riskStale > 0) items.push({ title: `${s.riskStale} сделок без активности`, desc: "Не обновлялись 7+ дней" });
    if (s.riskNoBudget > 0) items.push({ title: `${s.riskNoBudget} сделок без бюджета`, desc: "Нельзя посчитать pipeline корректно" });
    if (s.riskNoCompany > 0) items.push({ title: `${s.riskNoCompany} сделок без компании`, desc: "Проверьте связь deal → company" });
    if (!items.length) items.push({ title: "Риски не обнаружены", desc: "Всё выглядит аккуратно по базовым сигналам" });
    return items.slice(0, 3);
  }

  function computeBottlenecks(list: Deal[]) {
    const rows = stageTable(list);
    return rows
      .map((row) => {
        const inStage = (list ?? []).filter((d) => String(d.stage_id ?? d.expand?.stage_id?.id ?? "") === String(row.id));
        const staleDays = inStage
          .map((d) => {
            const u = d?.updated ? new Date(d.updated) : null;
            if (!u) return null;
            return daysBetween(now, u);
          })
          .filter((x): x is number => typeof x === "number");
        const avgStale = staleDays.length ? Math.round(staleDays.reduce((a, b) => a + b, 0) / staleDays.length) : 0;
        return { ...row, avgStale };
      })
      .filter((x) => x.count > 0)
      .sort((a, b) => b.avgStale - a.avgStale)
      .slice(0, 5);
  }

  function computePriorityActions(list: Deal[]) {
    return (list ?? [])
      .map((d) => {
        const updated = d.updated ? new Date(d.updated) : null;
        const staleDays = updated ? daysBetween(now, updated) : 0;
        const score = Number(d.current_score ?? 0);
        const amount = dealAmount(d);
        const missingBudget = !Number(d?.budget ?? 0);
        const missingCompany = !(d?.company_id ?? d?.expand?.company_id?.id);
        const riskPoints =
          staleDays * 1.5 +
          (score > 0 ? Math.max(0, 60 - score) : 25) +
          (missingBudget ? 18 : 0) +
          (missingCompany ? 14 : 0) +
          (amount > 0 ? Math.min(25, amount / 1_500_000) : 0);
        return {
          id: String(d.id || ""),
          title: String(d.title || "Сделка"),
          riskPoints: Math.round(riskPoints),
          staleDays,
          score,
          amount,
        };
      })
      .sort((a, b) => b.riskPoints - a.riskPoints)
      .slice(0, 5);
  }

  function exportDealsCsv(list: Deal[]) {
    const headers = ["deal_id", "title", "stage", "owner", "score", "budget", "turnover", "updated"];
    const lines = [headers.join(";")];
    for (const d of list ?? []) {
      const row = [
        String(d.id || ""),
        String(d.title || "").replace(/;/g, ","),
        String(d.expand?.stage_id?.stage_name || ""),
        String(d.expand?.responsible_id?.full_name || d.expand?.responsible_id?.name || d.expand?.responsible_id?.email || ""),
        String(Number(d.current_score ?? 0) || ""),
        String(Number(d.budget ?? 0) || ""),
        String(Number(d.turnover ?? 0) || ""),
        String(d.updated || ""),
      ];
      lines.push(row.join(";"));
    }
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dashboard-snapshot-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const loading = stagesQ.isLoading || dealsQ.isLoading || usersQ.isLoading || companiesQ.isLoading;

  const pageWrapperClass = cfg.dashboardVisual === "classic" ? "rounded-card border border-border bg-white p-6" : "cockpit-panel p-6";

  const openDashboardSettings = () => setLayoutEditMode((v) => !v);

  const openWidgetSettings = (id: WidgetId) => {
    setSettingsTarget(id);
    setSettingsOpen(true);
  };

  function WidgetFrame({
    title,
    subtitle,
    widgetId,
    children,
    onDrill: _onDrill,
  }: {
    title: string;
    subtitle?: string;
    widgetId: WidgetId;
    children: React.ReactNode;
    onDrill?: () => void;
  }) {
    return (
      <div className="ui-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-extrabold">{title}</div>
            {subtitle ? <div className="text-xs text-text2 mt-1">{subtitle}</div> : null}
          </div>
          <div className="flex items-center gap-2">
            <button
              className="h-9 w-9 rounded-2xl border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.08)] flex items-center justify-center"
              title="Настроить виджет"
              onClick={() => openWidgetSettings(widgetId)}
            >
              <Settings2 size={16} className="text-text" />
            </button>
          </div>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    );
  }

  const dealsAll: Deal[] = deals ?? [];
  const dealsScoped: Deal[] = isAdmin ? dealsAll : dealsAll.filter((d) => String(d.responsible_id ?? d.expand?.responsible_id?.id ?? "") === String(user?.id ?? ""));
  const companiesAll: Company[] = (companiesQ.data ?? []) as Company[];
  const companiesScoped: Company[] = isAdmin
    ? companiesAll
    : companiesAll.filter((c) => String(c.responsible_id ?? "") === String(user?.id ?? ""));

  // Widget data (computed once per render; deals list is capped)
  const globalApplied = applyWidgetFilters(dealsScoped, isAdmin ? globalFilters : { ...globalFilters, ownerId: String(user?.id || "") });
  const dealsGlobal = globalApplied.arr;
  const compareFrom = new Date(globalApplied.from.getTime() - (Number(globalFilters.rangeDays) || 30) * 24 * 60 * 60 * 1000);
  const dealsPrevPeriod = dealsAll.filter((d) => {
    const c = d?.created ? new Date(d.created) : null;
    if (!c) return false;
    if (c < compareFrom || c >= globalApplied.from) return false;
    if (globalFilters.stageId && (d.stage_id ?? d.expand?.stage_id?.id) !== globalFilters.stageId) return false;
    const scopedOwnerId = isAdmin ? globalFilters.ownerId : String(user?.id ?? "");
    if (scopedOwnerId && (d.responsible_id ?? d.expand?.responsible_id?.id) !== scopedOwnerId) return false;
    if (globalFilters.channel && String(d.sales_channel ?? "") !== String(globalFilters.channel)) return false;
    if (typeof globalFilters.budgetMin === "number" && Number(d?.budget ?? 0) < globalFilters.budgetMin) return false;
    if (typeof globalFilters.budgetMax === "number" && Number(d?.budget ?? 0) > globalFilters.budgetMax) return false;
    if (typeof globalFilters.scoreMin === "number" && Number(d?.current_score ?? 0) < globalFilters.scoreMin) return false;
    if (typeof globalFilters.scoreMax === "number" && Number(d?.current_score ?? 0) > globalFilters.scoreMax) return false;
    return true;
  });

  const wStat = applyWidgetFilters(dealsScoped, cfg.widgets.statCards.syncWithGlobal ? globalFilters : cfg.widgets.statCards.filters);
  const sStat = computeStats(wStat.arr);
  const sStatPrev = computeStats(applyWidgetFilters(dealsPrevPeriod, cfg.widgets.statCards.filters).arr);

  const wDyn = applyWidgetFilters(dealsScoped, cfg.widgets.dynamics.syncWithGlobal ? globalFilters : cfg.widgets.dynamics.filters);
  const dynBars = computeDynamics(wDyn.arr);

  const wWR = applyWidgetFilters(dealsScoped, cfg.widgets.winRate.syncWithGlobal ? globalFilters : cfg.widgets.winRate.filters);
  const wr2 = computeWinRateVariant2(wWR.arr, wWR.from);

  const wFunnel = applyWidgetFilters(dealsScoped, cfg.widgets.funnel.syncWithGlobal ? globalFilters : cfg.widgets.funnel.filters);
  const funnelRows = stageTable(wFunnel.arr);

  const wBudget = applyWidgetFilters(dealsScoped, cfg.widgets.budgetByStage.syncWithGlobal ? globalFilters : cfg.widgets.budgetByStage.filters);
  const budgetRows = stageTable(wBudget.arr);
  const maxBudget = Math.max(1, ...budgetRows.map((r) => r.sum));

  const wManagers = applyWidgetFilters(dealsScoped, cfg.widgets.topManagers.syncWithGlobal ? globalFilters : cfg.widgets.topManagers.filters);
  const managers = topManagersTable(wManagers.arr);

  const wInsights = applyWidgetFilters(dealsScoped, cfg.widgets.insights.syncWithGlobal ? globalFilters : cfg.widgets.insights.filters);
  const ins = insightsFromStats(computeStats(wInsights.arr));
  const bottlenecks = computeBottlenecks(dealsGlobal);
  const priorityActions = computePriorityActions(dealsGlobal);

  const deltaPipeline = sStatPrev.pipeline ? ((sStat.pipeline - sStatPrev.pipeline) / sStatPrev.pipeline) * 100 : 0;
  const deltaWeighted = sStatPrev.weighted ? ((sStat.weighted - sStatPrev.weighted) / sStatPrev.weighted) * 100 : 0;
  const deltaDeals = sStatPrev.dealsCount ? ((sStat.dealsCount - sStatPrev.dealsCount) / sStatPrev.dealsCount) * 100 : 0;
  const deltaCycle = sStatPrev.cycle ? ((sStat.cycle - sStatPrev.cycle) / sStatPrev.cycle) * 100 : 0;

  function localAdminSummary() {
    const lines: string[] = [];
    lines.push(`Период: ${globalFilters.rangeDays || 30} дней. Сделок в срезе: ${dealsGlobal.length}.`);
    lines.push(`Pipeline ${money(sStat.pipeline)} ₽ (${deltaPipeline >= 0 ? "+" : ""}${deltaPipeline.toFixed(1)}% к прошлому периоду).`);
    lines.push(`Взвешенный pipeline ${money(sStat.weighted)} ₽ (${deltaWeighted >= 0 ? "+" : ""}${deltaWeighted.toFixed(1)}%).`);
    if (bottlenecks.length) lines.push(`Узкое место: этап "${bottlenecks[0].name}" (среднее зависание ${bottlenecks[0].avgStale} дн.).`);
    if (priorityActions.length) lines.push(`Приоритет №1: "${priorityActions[0].title}" (риск ${priorityActions[0].riskPoints}).`);
    lines.push("Рекомендации: обновить зависшие сделки 7+ дней, закрыть пустые бюджеты, сфокусироваться на 5 приоритетных сделках.");
    return lines.join("\n");
  }

  function saveCurrentView() {
    const name = window.prompt("Название сохраненного вида");
    if (!name || !name.trim()) return;
    const view = { id: `${Date.now()}`, name: name.trim(), globalFilters, cfg };
    const next = [view, ...savedViews].slice(0, 20);
    setSavedViews(next);
    setActiveViewId(view.id);
    try {
      localStorage.setItem("nwlvl_dashboard_views", JSON.stringify(next));
    } catch {}
  }

  function applyView(viewId: string) {
    const target = savedViews.find((v) => v.id === viewId);
    if (!target) return;
    setActiveViewId(target.id);
    setGlobalFilters(target.globalFilters);
    setCfg(target.cfg);
  }

  function moveWidgetTo(sourceId: WidgetId, targetId: WidgetId) {
    if (sourceId === targetId) return;
    setCfg((prev) => {
      const next = [...prev.widgetOrder];
      const oldIndex = next.indexOf(sourceId);
      const newIndex = next.indexOf(targetId);
      if (oldIndex < 0 || newIndex < 0) return prev;
      const [item] = next.splice(oldIndex, 1);
      next.splice(newIndex, 0, item);
      return { ...prev, widgetOrder: next };
    });
  }

  function onWidgetDragEnd(event: { active?: { id?: string | number }; over?: { id?: string | number } | null }) {
    if (!layoutEditMode) return;
    const sourceId = String(event?.active?.id || "") as WidgetId;
    const targetId = String(event?.over?.id || "") as WidgetId;
    if (!sourceId || !targetId) return;
    moveWidgetTo(sourceId, targetId);
    setDraggingWidgetId(null);
    setOverWidgetId(null);
  }

  const normalizedFieldName = React.useCallback((source: "deals" | "companies", key: string) => {
    const dealMap: Record<string, string> = {
      id: "ID сделки",
      title: "Название сделки",
      budget: "Бюджет",
      turnover: "Оборот",
      current_score: "Вероятность",
      sales_channel: "Канал",
      stage_name: "Этап",
      responsible: "Ответственный",
      company: "Компания",
      created: "Создана",
      updated: "Обновлена",
    };
    const companyMap: Record<string, string> = {
      id: "ID компании",
      name: "Компания",
      inn: "ИНН",
      city: "Город",
      website: "Сайт",
      email: "Email",
      phone: "Телефон",
      legal_entity: "Юр. лицо",
      created: "Создана",
      updated: "Обновлена",
    };
    const sourceMap = source === "deals" ? dealMap : companyMap;
    return sourceMap[key] || key.replace(/_/g, " ");
  }, []);

  const customFieldOptions = React.useMemo(() => {
    const base = customSource === "deals"
      ? ["id", "title", "budget", "turnover", "current_score", "sales_channel", "stage_name", "responsible", "company", "created", "updated"]
      : ["id", "name", "inn", "city", "website", "email", "phone", "legal_entity", "created", "updated"];
    const dynamic = new Set<string>(base);
    const sampleRows = customSource === "deals" ? dealsAll.slice(0, 200) : companiesAll.slice(0, 200);
    for (const row of sampleRows as Array<Record<string, unknown>>) {
      Object.keys(row || {}).forEach((k) => {
        if (k !== "expand") dynamic.add(k);
      });
    }
    return Array.from(dynamic).sort((a, b) => a.localeCompare(b));
  }, [customSource]);

  const filteredCustomFieldOptions = React.useMemo(() => {
    const q = customSearch.trim().toLowerCase();
    if (!q) return customFieldOptions;
    return customFieldOptions.filter((key) => {
      const ru = normalizedFieldName(customSource, key).toLowerCase();
      return key.toLowerCase().includes(q) || ru.includes(q);
    });
  }, [customFieldOptions, customSearch, normalizedFieldName, customSource]);

  function addPresetReport(kind: "finance" | "pipeline" | "team") {
    const preset = kind === "finance"
      ? { id: `${Date.now()}-finance`, name: "Финансы по сделкам", source: "deals" as const, columns: ["title", "budget", "turnover", "current_score", "responsible"] }
      : kind === "pipeline"
      ? { id: `${Date.now()}-pipeline`, name: "Состояние воронки", source: "deals" as const, columns: ["title", "stage_name", "current_score", "updated"] }
      : { id: `${Date.now()}-team`, name: "Нагрузка по менеджерам", source: "deals" as const, columns: ["responsible", "title", "budget", "updated"] };
    const next = [preset, ...customReports].slice(0, 30);
    setCustomReports(next);
    localStorage.setItem("nwlvl_dashboard_custom_reports", JSON.stringify(next));
  }

  function addCustomReport() {
    if (!customName.trim() || !customColumns.length) return;
    const nextReport = { id: `${Date.now()}-custom`, name: customName.trim(), source: customSource, columns: customColumns };
    const next = [nextReport, ...customReports].slice(0, 30);
    setCustomReports(next);
    localStorage.setItem("nwlvl_dashboard_custom_reports", JSON.stringify(next));
  }

  async function refreshAdminAiSummary() {
    setAiSummaryLoading(true);
    setAiSummaryError("");
    const context = {
      filters: globalFilters,
      metrics: {
        pipeline: sStat.pipeline,
        weighted_pipeline: sStat.weighted,
        deals_count: sStat.dealsCount,
        cycle_days: sStat.cycle,
        delta_pipeline_pct: Number(deltaPipeline.toFixed(2)),
        delta_weighted_pct: Number(deltaWeighted.toFixed(2)),
        delta_deals_pct: Number(deltaDeals.toFixed(2)),
        delta_cycle_pct: Number(deltaCycle.toFixed(2)),
      },
      bottlenecks: bottlenecks.map((x) => ({ stage: x.name, avg_stale_days: x.avgStale, deals: x.count })),
      priorities: priorityActions,
      output_contract: {
        language: "ru",
        style: "executive",
        sections: ["Вывод", "Что просело", "Что делать за 24/72 часа", "Риски квартала"],
      },
      admin_prompt_code: isAdmin ? "founder_dashboard_brief_v1" : "manager_dashboard_brief_v1",
      mode: isAdmin ? "admin" : "manager",
    };
    try {
      const promptCode = isAdmin ? "founder_dashboard_brief_v1" : "manager_dashboard_brief_v1";
      const resp = await analyzeAdminDashboardWithAi({
        userId: String((pb.authStore.model as { id?: string } | null)?.id || ""),
        promptCode,
        context,
      });
      const text = String(
        (resp.summary as string) ||
          (resp.text as string) ||
          ((resp.result as Record<string, unknown> | undefined)?.summary as string) ||
          "",
      ).trim();
      setAiSummaryText(text || localAdminSummary());
      if (!text) setAiSummaryError("AI вернул пустой ответ, показан локальный executive summary.");
    } catch (e) {
      setAiSummaryError(e instanceof Error ? e.message : "Не удалось получить AI-вывод, показан локальный summary.");
      setAiSummaryText(localAdminSummary());
    } finally {
      setAiSummaryLoading(false);
    }
  }

  React.useEffect(() => {
    if (loading) return;
    void refreshAdminAiSummary();
  }, [loading, JSON.stringify(globalFilters)]);

  React.useEffect(() => {
    if (!resizeState) return;
    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - resizeState.startX;
      const dy = e.clientY - resizeState.startY;
      const gridWidth = reportsGridRef.current?.getBoundingClientRect().width ?? 0;
      const colWidth = gridWidth > 0 ? gridWidth / 24 : 48;
      const xStep = Math.round(dx / Math.max(16, colWidth));
      const yStep = Math.round(dy / 48);
      let nextSpan = resizeState.startSpan;
      let nextRowSpan = resizeState.startRowSpan;
      if (resizeState.edge === "right") nextSpan = Math.max(2, Math.min(24, resizeState.startSpan + xStep));
      if (resizeState.edge === "left") nextSpan = Math.max(2, Math.min(24, resizeState.startSpan - xStep));
      if (resizeState.edge === "bottom") nextRowSpan = Math.max(4, Math.min(120, resizeState.startRowSpan + yStep));
      if (resizeState.edge === "top") nextRowSpan = Math.max(4, Math.min(120, resizeState.startRowSpan - yStep));
      setCfg((prev) => ({
        ...prev,
        widgets: {
          ...prev.widgets,
          [resizeState.id]: { ...prev.widgets[resizeState.id], span: nextSpan, rowSpan: nextRowSpan },
        },
      }));
    };
    const onUp = () => setResizeState(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [resizeState]);

  function renderWidget(wid: WidgetId) {
    if (!cfg.widgets[wid].enabled) return null;
    if (wid === "insights") {
      return null;
    }
    if (wid === "statCards") {
      return (
        <WidgetFrame title="Ключевые метрики" subtitle={`Период: последние ${cfg.widgets.statCards.filters.rangeDays || 30} дней`} widgetId="statCards">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard title="Pipeline" value={`${money(sStat.pipeline)} ₽`} icon={TrendingUp} hint="Сумма активных сделок (budget/turnover)" />
            <StatCard title="Взвешенный" value={`${money(sStat.weighted)} ₽`} icon={Percent} hint={`Δ ${deltaWeighted >= 0 ? "+" : ""}${deltaWeighted.toFixed(1)}%`} />
            <StatCard title="Сделки" value={`${sStat.dealsCount}`} icon={CircleDot} hint={`Δ ${deltaDeals >= 0 ? "+" : ""}${deltaDeals.toFixed(1)}%`} />
            <StatCard title="Цикл" value={`${sStat.cycle} д`} icon={Clock} hint={`Δ ${deltaCycle >= 0 ? "+" : ""}${deltaCycle.toFixed(1)}%`} />
          </div>
        </WidgetFrame>
      );
    }
    if (wid === "dynamics") return <WidgetFrame title="Динамика входящих" subtitle="Новые сделки по неделям (8 недель)" widgetId="dynamics"><MiniBars values={dynBars} /></WidgetFrame>;
    if (wid === "winRate") return <WidgetFrame title="Доля побед" subtitle={`Вариант 2: победы/(победы+потери) за ${cfg.widgets.winRate.filters.rangeDays || 30} дней`} widgetId="winRate"><div className="flex items-center justify-center"><div><div className="flex items-center justify-center"><Donut value={wr2.rate} /></div><div className="mt-2 text-xs text-text2 text-center">Won: {wr2.won} · Lost: {wr2.lost}</div></div></div></WidgetFrame>;
    if (wid === "funnel") {
      return (
        <WidgetFrame title="Воронка" subtitle="Количество и сумма по этапам (клик по этапу → сделки)" widgetId="funnel">
          {cfg.widgets.funnel.visual === "classic" ? (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-text2"><th className="py-2">Этап</th><th className="py-2 text-right">Сделок</th><th className="py-2 text-right">Сумма</th></tr></thead>
                <tbody>{funnelRows.map((r) => <tr key={r.id} className="border-t border-[rgba(255,255,255,0.10)] hover:bg-[rgba(255,255,255,0.06)] cursor-pointer" onClick={() => drillToDeals({ ...cfg.widgets.funnel.filters, stageId: r.id })}><td className="py-2 font-semibold">{r.name}</td><td className="py-2 text-right">{r.count}</td><td className="py-2 text-right">{money(r.sum)} ₽</td></tr>)}</tbody>
              </table>
            </div>
          ) : (
            <div className="space-y-3">{funnelRows.map((r) => <button key={r.id} className="w-full text-left p-3 rounded-[16px] border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.10)]" onClick={() => drillToDeals({ ...cfg.widgets.funnel.filters, stageId: r.id })}><div className="flex items-center justify-between"><div className="text-sm font-extrabold">{r.name}</div><div className="text-sm font-extrabold">{r.count}</div></div><div className="text-xs text-text2 mt-1">Сумма: {money(r.sum)} ₽</div></button>)}</div>
          )}
        </WidgetFrame>
      );
    }
    if (wid === "budgetByStage") {
      return (
        <WidgetFrame title="Бюджет по этапам" subtitle="Горизонтальные бары по сумме (клик → сделки)" widgetId="budgetByStage">
          <div className="space-y-2">
            {budgetRows.map((r) => (
              <button key={r.id} className="w-full text-left" onClick={() => drillToDeals({ ...cfg.widgets.budgetByStage.filters, stageId: r.id })}>
                <div className="flex items-center justify-between text-xs"><span className="font-semibold">{r.name}</span><span className="text-text2">{money(r.sum)} ₽</span></div>
                <div className="mt-1 h-2 rounded-full bg-[rgba(255,255,255,0.10)] overflow-hidden"><div className="h-2 rounded-full" style={{ width: `${Math.round((r.sum / maxBudget) * 100)}%`, background: "linear-gradient(90deg, rgba(87,183,255,0.95), rgba(44,158,255,0.38))" }} /></div>
              </button>
            ))}
          </div>
        </WidgetFrame>
      );
    }
    if (wid === "topManagers") {
      return (
        <WidgetFrame title="Менеджеры" subtitle="Топ по пайплайну (клик → сделки)" widgetId="topManagers">
          <div className="space-y-3">
            {managers.length ? managers.map((m) => (
              <button key={m.id} className="w-full flex items-center justify-between hover:bg-[rgba(255,255,255,0.06)] rounded-[14px] p-2" onClick={() => drillToDeals({ ...cfg.widgets.topManagers.filters, ownerId: m.id })}>
                <div><div className="text-sm font-bold">{m.name}</div><div className="text-xs text-text2">Сделок: {m.deals}</div></div>
                <div className="text-sm font-extrabold">{money(m.pipeline)} ₽</div>
              </button>
            )) : <div className="text-sm text-text2">Нет данных по ответственным</div>}
          </div>
        </WidgetFrame>
      );
    }
    return null;
  }

  return (
    <div className="grid gap-6">
      <div className={pageWrapperClass}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(51,215,255,0.35)] bg-[rgba(51,215,255,0.12)] px-3 py-1 text-xs font-semibold mb-2">
              Управленческая панель
            </div>
            <div className="inline-flex items-center gap-2 text-[11px] font-semibold mb-2">
              <span className="neon-pill">Живая аналитика</span>
              <span className="neon-pill">Фокус на выручке</span>
            </div>
            <div className="text-xl font-extrabold tracking-wide">Дашборд продаж</div>
            <div className="mt-1 text-sm subtle">Глобальные фильтры применяются ко всем отчетам по умолчанию, с возможностью переопределения</div>
          </div>
          <div className="flex items-center gap-2">
            <select className="ui-input h-9 min-w-[180px]" value={activeViewId} onChange={(e) => applyView(e.target.value)}>
              <option value="">Сохраненные виды</option>
              {savedViews.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
            <Button small variant="secondary" onClick={saveCurrentView} className="h-9">
              Сохранить вид
            </Button>
            <Button small variant="secondary" onClick={() => exportDealsCsv(dealsGlobal)} className="h-9">
              <span className="inline-flex items-center gap-2"><Download size={16} /> Экспорт среза</span>
            </Button>
            <Button small variant="secondary" onClick={openDashboardSettings} className="h-9">
              <span className="inline-flex items-center gap-2"><BarChart3 size={16} /> {layoutEditMode ? "Завершить настройку" : "Настроить дашборд"}</span>
            </Button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 xl:grid-cols-8 gap-2">
          <select className="ui-input md:col-span-1 xl:col-span-2" value={String(globalFilters.rangeDays || 30)} onChange={(e) => setGlobalFilters((p) => ({ ...p, rangeDays: Number(e.target.value) || 30 }))}>
            <option value="7">Глобально: 7 дней</option>
            <option value="30">Глобально: 30 дней</option>
            <option value="90">Глобально: 90 дней</option>
            <option value="365">Глобально: 365 дней</option>
          </select>
          <select className="ui-input md:col-span-1 xl:col-span-2" value={globalFilters.stageId ?? ""} onChange={(e) => setGlobalFilters((p) => ({ ...p, stageId: e.target.value }))}>
            <option value="">Все этапы</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>{s.stage_name ?? "Этап"}</option>
            ))}
          </select>
          <select className="ui-input md:col-span-1 xl:col-span-2" value={isAdmin ? (globalFilters.ownerId ?? "") : String(user?.id ?? "")} disabled={!isAdmin} onChange={(e) => setGlobalFilters((p) => ({ ...p, ownerId: e.target.value }))}>
            <option value="">Все ответственные</option>
            {(usersQ.data ?? []).map((u: UserSummary) => (
              <option key={u.id} value={u.id}>{u.full_name ?? u.name ?? u.email}</option>
            ))}
          </select>
          <input className="ui-input md:col-span-1 xl:col-span-2" value={globalFilters.channel ?? ""} onChange={(e) => setGlobalFilters((p) => ({ ...p, channel: e.target.value }))} placeholder="Канал (глобально)" />
        </div>

        <div className="mt-4 ui-card p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-extrabold">Блок управления дашбордом</div>
              <div className="text-xs text-text2 mt-1">Фильтрация, редактирование раскладки, сохранение вида и создание кастомных отчетов.</div>
            </div>
            <Button small variant="secondary" onClick={() => setControlsCollapsed((v) => !v)}>
              {controlsCollapsed ? "Развернуть" : "Свернуть"}
            </Button>
          </div>
          {controlsCollapsed ? null : (
            <div className="mt-3 grid grid-cols-1 xl:grid-cols-3 gap-2">
              <Button small variant={layoutEditMode ? "primary" : "secondary"} onClick={openDashboardSettings}>
                {layoutEditMode ? "Выключить режим редактирования" : "Включить режим редактирования"}
              </Button>
              <Button small variant="secondary" onClick={() => setCustomBuilderOpen(true)}>
                Настройка отчета (модалка)
              </Button>
              <Button small variant="secondary" onClick={() => setCfg(DEFAULT_CFG)}>
                Сбросить раскладку
              </Button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="mt-6 text-sm text-text2">Загрузка данных...</div>
        ) : (
          <>
            <div className="mt-6 ui-card p-4 neon-accent">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-extrabold inline-flex items-center gap-2"><Sparkles size={16} /> {isAdmin ? "ИИ-вывод для руководителя" : "ИИ-вывод для менеджера"}</div>
                  <div className="text-xs text-text2 mt-1">
                    Режим: {isAdmin ? "админ/руководитель" : "менеджер"} · prompt `{isAdmin ? "founder_dashboard_brief_v1" : "manager_dashboard_brief_v1"}`.
                  </div>
                </div>
                <Button small variant="secondary" onClick={() => void refreshAdminAiSummary()} disabled={aiSummaryLoading}>
                  {aiSummaryLoading ? "Обновление..." : "Обновить AI-вывод"}
                </Button>
              </div>
              {aiSummaryError ? <div className="mt-2 text-xs text-danger">{aiSummaryError}</div> : null}
              <div className="mt-3 whitespace-pre-wrap text-sm">{aiSummaryText || "Готовим вывод..."}</div>
            </div>

            <div className="mt-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
              <WidgetFrame title="Ключевые сигналы" subtitle="Быстрые сигналы по данным" widgetId="insights">
                <div className="space-y-3">
                  {ins.map((x) => (
                    <div key={x.title} className="p-3 rounded-[16px] border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.08)]">
                      <div className="text-sm font-extrabold">{x.title}</div>
                      <div className="text-xs text-text2 mt-1">{x.desc}</div>
                    </div>
                  ))}
                </div>
              </WidgetFrame>

              <WidgetFrame title="Узкие места воронки" subtitle="Этапы с максимальным средним зависанием" widgetId="funnel">
                <div className="space-y-2">
                  {bottlenecks.length ? bottlenecks.map((b) => (
                    <div key={b.id} className="rounded-[14px] border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.06)] p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-semibold">{b.name}</div>
                        <div className="text-xs text-text2">{b.count} сделок</div>
                      </div>
                      <div className="text-xs text-text2 mt-1">Среднее зависание: {b.avgStale} дн.</div>
                    </div>
                  )) : <div className="text-sm text-text2">Нет данных для анализа узких мест.</div>}
                </div>
              </WidgetFrame>

              <WidgetFrame title="Топ-5 приоритетных действий" subtitle="Сделки с максимальным риском просадки" widgetId="insights">
                <div className="space-y-2">
                  {priorityActions.length ? priorityActions.map((a) => (
                    <button key={a.id} className="w-full text-left rounded-[14px] border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.06)] p-3 hover:bg-[rgba(255,255,255,0.1)]" onClick={() => nav(`/deals/${a.id}`)}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-semibold truncate">{a.title}</div>
                        <div className="text-xs text-text2">Риск {a.riskPoints}</div>
                      </div>
                      <div className="mt-1 text-xs text-text2">
                        Вероятность: {a.score || "—"} · Зависание: {a.staleDays} дн. · Сумма: {money(a.amount)} ₽
                      </div>
                    </button>
                  )) : <div className="text-sm text-text2">Нет приоритетных сделок в выбранном срезе.</div>}
                </div>
              </WidgetFrame>
            </div>

            <div className="mt-6">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={(e) => setDraggingWidgetId(String(e.active?.id || "") as WidgetId)}
                onDragOver={(e) => setOverWidgetId(e.over ? (String(e.over.id) as WidgetId) : null)}
                onDragEnd={onWidgetDragEnd}
                onDragCancel={() => {
                  setDraggingWidgetId(null);
                  setOverWidgetId(null);
                }}
              >
                <SortableContext items={cfg.widgetOrder.filter((x) => x !== "insights")} strategy={rectSortingStrategy}>
                  <div
                    ref={reportsGridRef}
                    className={`grid grid-cols-1 relative auto-rows-[24px] ${layoutEditMode ? "gap-1" : "gap-4"}`}
                    style={{
                      gridTemplateColumns: "repeat(24, minmax(0, 1fr))",
                      ...(layoutEditMode
                        ? {
                            backgroundImage:
                              "linear-gradient(to right, rgba(51,215,255,0.14) 1px, transparent 1px), linear-gradient(to bottom, rgba(51,215,255,0.08) 1px, transparent 1px)",
                            backgroundSize: "calc(100% / 24) 24px, 100% 24px",
                            borderRadius: "14px",
                            padding: "8px",
                          }
                        : {}),
                    }}
                  >
                    {cfg.widgetOrder.map((wid) => (
                      wid === "insights" ? null : (
                        <SortableReportItem
                          key={wid}
                          id={wid}
                          editMode={layoutEditMode}
                          colSpan={cfg.widgets[wid].span ?? 8}
                          rowSpan={cfg.widgets[wid].rowSpan ?? 10}
                          isDropAllowed={Boolean(overWidgetId)}
                          isDropTarget={overWidgetId === wid}
                          onResizeStart={(edge, e) => {
                            e.preventDefault();
                            setResizeState({
                              id: wid,
                              edge,
                              startX: e.clientX,
                              startY: e.clientY,
                              startSpan: cfg.widgets[wid].span ?? 8,
                              startRowSpan: cfg.widgets[wid].rowSpan ?? 10,
                            });
                          }}
                        >
                          {renderWidget(wid)}
                        </SortableReportItem>
                      )
                    ))}
                  </div>
                </SortableContext>
                <DragOverlay>
                  {draggingWidgetId ? (
                    <div className={`ui-card p-4 ${overWidgetId ? "ring-2 ring-[rgba(0,216,122,0.95)] shadow-[0_0_28px_rgba(0,216,122,0.55)]" : "ring-2 ring-[rgba(239,68,68,0.95)] shadow-[0_0_28px_rgba(239,68,68,0.55)]"}`}>
                      <div className="text-sm font-extrabold">Перемещение отчета</div>
                      <div className="text-xs text-text2 mt-1">{draggingWidgetId}</div>
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
              {layoutEditMode ? <div className="mt-2 text-xs text-text2">Режим редактирования активен: тяните карточку за мышкой (как в Miro), зеленая неоновая рамка — можно поставить, красная — нельзя. Размер меняется за границы карточки.</div> : null}
              {layoutEditMode ? <div className="mt-1 text-[11px] text-text2">Сетка: 12/12 по ширине, шаг по высоте 24px. Resize: справа — ширина, снизу — высота.</div> : null}
            </div>

            <div className="mt-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
              {customReports.map((report) => {
                const rows = report.source === "deals"
                  ? dealsGlobal.slice(0, 30).map((d) => ({
                      id: String(d.id || ""),
                      title: String(d.title || ""),
                      budget: Number(d.budget ?? 0),
                      turnover: Number(d.turnover ?? 0),
                      current_score: Number(d.current_score ?? 0),
                      sales_channel: String(d.sales_channel || ""),
                      stage_name: String(d.expand?.stage_id?.stage_name || ""),
                      responsible: String(d.expand?.responsible_id?.full_name || d.expand?.responsible_id?.name || d.expand?.responsible_id?.email || ""),
                      company: String(d.expand?.company_id?.name || ""),
                      created: String(d.created || ""),
                      updated: String(d.updated || ""),
                    }))
                  : companiesScoped.slice(0, 30).map((c) => ({
                      id: String(c.id || ""),
                      name: String(c.name || ""),
                      inn: String(c.inn || ""),
                      city: String(c.city || ""),
                      website: String(c.website || ""),
                      email: String(c.email || ""),
                      phone: String(c.phone || ""),
                      legal_entity: String(c.legal_entity || ""),
                      created: String(c.created || ""),
                      updated: String(c.updated || ""),
                    }));
                return (
                  <div key={report.id} className="rounded-[14px] border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.06)] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-extrabold">{report.name}</div>
                        <div className="text-xs text-text2 mt-1">{report.source === "deals" ? "Сделки" : "Компании"} · полей: {report.columns.length}</div>
                      </div>
                      <button
                        className="h-8 rounded-md border border-[rgba(239,68,68,0.45)] bg-[rgba(239,68,68,0.12)] px-2 text-xs"
                        onClick={() => {
                          const next = customReports.filter((x) => x.id !== report.id);
                          setCustomReports(next);
                          localStorage.setItem("nwlvl_dashboard_custom_reports", JSON.stringify(next));
                        }}
                      >
                        Удалить
                      </button>
                    </div>
                    <div className="overflow-auto mt-3">
                      <table className="min-w-[520px] w-full text-xs">
                        <thead><tr className="text-left text-text2">{report.columns.map((c) => <th key={c} className="py-1 pr-3">{normalizedFieldName(report.source, c)}</th>)}</tr></thead>
                        <tbody>{rows.slice(0, 7).map((row, idx) => <tr key={`${report.id}-${idx}`} className="border-t border-[rgba(255,255,255,0.08)]">{report.columns.map((c) => <td key={c} className="py-1 pr-3">{String((row as Record<string, unknown>)[c] ?? "")}</td>)}</tr>)}</tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
              {!customReports.length ? <div className="text-sm text-text2">Пока нет кастомных отчетов в блоке отчетов.</div> : null}
            </div>

          </>
        )}
      </div>

      <Modal
        open={customBuilderOpen}
        title="Настройка отчета"
        onClose={() => setCustomBuilderOpen(false)}
        widthClass="max-w-3xl"
      >
        <div className="grid gap-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <input className="ui-input" value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Название отчета" />
            <select className="ui-input" value={customSource} onChange={(e) => setCustomSource(e.target.value as "deals" | "companies")}>
              <option value="deals">Источник: Сделки</option>
              <option value="companies">Источник: Компании</option>
            </select>
            <input className="ui-input" value={customSearch} onChange={(e) => setCustomSearch(e.target.value)} placeholder="Поиск поля (рус/тех)" />
          </div>

          <div className="rounded-card border border-border bg-rowHover p-3">
            <div className="text-xs text-text2 mb-2">Все поля из доступных данных PocketBase (нормализованы)</div>
            <div className="max-h-[260px] overflow-auto grid grid-cols-1 md:grid-cols-2 gap-2">
              {filteredCustomFieldOptions.map((field) => (
                <label key={field} className="flex items-center gap-2 text-sm rounded-md border border-border bg-white px-2 py-1.5">
                  <input
                    type="checkbox"
                    checked={customColumns.includes(field)}
                    onChange={(e) => {
                      if (e.target.checked) setCustomColumns((prev) => (prev.includes(field) ? prev : [...prev, field]));
                      else setCustomColumns((prev) => prev.filter((x) => x !== field));
                    }}
                  />
                  <span>{normalizedFieldName(customSource, field)}</span>
                  <span className="text-[10px] text-text2">{field}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button small variant="secondary" onClick={() => addPresetReport("finance")}>Пресет: Финансы</Button>
            <Button small variant="secondary" onClick={() => addPresetReport("pipeline")}>Пресет: Воронка</Button>
            <Button small variant="secondary" onClick={() => addPresetReport("team")}>Пресет: Команда</Button>
            <Button small onClick={() => { addCustomReport(); setCustomBuilderOpen(false); }} disabled={!customName.trim() || !customColumns.length}>Добавить отчет в блок отчетов</Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={settingsOpen}
        title={`Настройка виджета: ${settingsTarget}`}
        onClose={() => setSettingsOpen(false)}
        widthClass="max-w-2xl"
      >
        {(() => {
            const wid = settingsTarget as WidgetId;
            const w = cfg.widgets[wid];
            const f = w.filters;

            const setFilters = (next: Partial<WidgetFilters>) =>
              setCfg((p) => ({ ...p, widgets: { ...p.widgets, [wid]: { ...p.widgets[wid], filters: { ...p.widgets[wid].filters, ...next } } } }));

            return (
              <div className="grid gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-text2 mb-1">Период</div>
                    <select
                      className="h-10 w-full rounded-card border border-[#9CA3AF] bg-white px-3 text-sm"
                      value={String(f.rangeDays ?? 30)}
                      onChange={(e) => setFilters({ rangeDays: Number(e.target.value) })}
                    >
                      <option value="7">Последние 7 дней</option>
                      <option value="30">Последние 30 дней</option>
                      <option value="90">Последние 90 дней</option>
                      <option value="365">Последний год</option>
                    </select>
                  </div>

                  {wid === "funnel" ? (
                    <div>
                      <div className="text-xs text-text2 mb-1">Визуал</div>
                      <select
                        className="h-10 w-full rounded-card border border-[#9CA3AF] bg-white px-3 text-sm"
                        value={w.visual ?? "cockpit"}
                        onChange={(e) => setCfg((p) => ({ ...p, widgets: { ...p.widgets, funnel: { ...p.widgets.funnel, visual: e.target.value as WidgetCfg["visual"] } } }))}
                      >
                        <option value="cockpit">Карточки</option>
                        <option value="classic">Таблица</option>
                      </select>
                    </div>
                  ) : (
                    <div>
                      <div className="text-xs text-text2 mb-1">Подсказка</div>
                      <div className="h-10 w-full rounded-card border border-border bg-white px-3 text-sm flex items-center text-text2">Настраивай фильтры ниже</div>
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-xs text-text2 mb-1">Размер виджета в сетке</div>
                  <select
                    className="h-10 w-full rounded-card border border-[#9CA3AF] bg-white px-3 text-sm"
                    value={String(w.span ?? 1)}
                    onChange={(e) =>
                      setCfg((p) => ({
                        ...p,
                        widgets: {
                          ...p.widgets,
                          [wid]: {
                            ...p.widgets[wid],
                            span: Number(e.target.value) as 1 | 2 | 3,
                          },
                        },
                      }))
                    }
                  >
                    <option value="1">Узкий (1 колонка)</option>
                    <option value="2">Средний (2 колонки)</option>
                    <option value="3">Широкий (3 колонки)</option>
                  </select>
                </div>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={w.syncWithGlobal}
                    onChange={(e) =>
                      setCfg((p) => ({
                        ...p,
                        widgets: {
                          ...p.widgets,
                          [wid]: {
                            ...p.widgets[wid],
                            syncWithGlobal: e.target.checked,
                            filters: e.target.checked ? { ...p.widgets[wid].filters, ...globalFilters } : p.widgets[wid].filters,
                          },
                        },
                      }))
                    }
                  />
                  Использовать глобальные фильтры как базу для этого отчета
                </label>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <div className="text-xs text-text2 mb-1">Этап</div>
                    <select
                      className="h-10 w-full rounded-card border border-[#9CA3AF] bg-white px-3 text-sm"
                      value={f.stageId ?? ""}
                      onChange={(e) => setFilters({ stageId: e.target.value })}
                    >
                      <option value="">Все этапы</option>
                      {stages.map((s) => (
                        <option key={s.id} value={s.id}>{s.stage_name ?? "Этап"}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className="text-xs text-text2 mb-1">Ответственный</div>
                    <select
                      className="h-10 w-full rounded-card border border-[#9CA3AF] bg-white px-3 text-sm"
                      value={isAdmin ? (f.ownerId ?? "") : String(user?.id ?? "")}
                      disabled={!isAdmin}
                      onChange={(e) => setFilters({ ownerId: e.target.value })}
                    >
                      <option value="">Все</option>
                      {(usersQ.data ?? []).map((u: UserSummary) => (
                        <option key={u.id} value={u.id}>{u.full_name ?? u.name ?? u.email}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className="text-xs text-text2 mb-1">Канал (текст)</div>
                    <input
                      className="h-10 w-full rounded-card border border-[#9CA3AF] bg-white px-3 text-sm"
                      value={f.channel ?? ""}
                      onChange={(e) => setFilters({ channel: e.target.value })}
                      placeholder="например: партнерский"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <div className="text-xs text-text2 mb-1">Бюджет от</div>
                    <input
                      type="number"
                      className="h-10 w-full rounded-card border border-[#9CA3AF] bg-white px-3 text-sm"
                      value={typeof f.budgetMin === "number" ? String(f.budgetMin) : ""}
                      onChange={(e) => setFilters({ budgetMin: e.target.value === "" ? undefined : Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <div className="text-xs text-text2 mb-1">Бюджет до</div>
                    <input
                      type="number"
                      className="h-10 w-full rounded-card border border-[#9CA3AF] bg-white px-3 text-sm"
                      value={typeof f.budgetMax === "number" ? String(f.budgetMax) : ""}
                      onChange={(e) => setFilters({ budgetMax: e.target.value === "" ? undefined : Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <div className="text-xs text-text2 mb-1">Score от</div>
                    <input
                      type="number"
                      className="h-10 w-full rounded-card border border-[#9CA3AF] bg-white px-3 text-sm"
                      value={typeof f.scoreMin === "number" ? String(f.scoreMin) : ""}
                      onChange={(e) => setFilters({ scoreMin: e.target.value === "" ? undefined : Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <div className="text-xs text-text2 mb-1">Score до</div>
                    <input
                      type="number"
                      className="h-10 w-full rounded-card border border-[#9CA3AF] bg-white px-3 text-sm"
                      value={typeof f.scoreMax === "number" ? String(f.scoreMax) : ""}
                      onChange={(e) => setFilters({ scoreMax: e.target.value === "" ? undefined : Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setCfg((p) => ({
                        ...p,
                        widgets: {
                          ...p.widgets,
                          [wid]: { ...p.widgets[wid], filters: { ...DEFAULT_WIDGET_FILTERS }, ...(wid === "funnel" ? { visual: "cockpit" } : {}) },
                        },
                      }));
                    }}
                  >
                    Сбросить виджет
                  </Button>
                  <Button onClick={() => setSettingsOpen(false)}>Готово</Button>
                </div>
              </div>
            );
          })()}
      </Modal>

      <Modal open={showScoringWelcome} title="Рекомендуемая модель AI-скоринга" onClose={acknowledgeScoringModel}>
        <div className="grid gap-3">
          <div className="text-sm">
            Для вашего кабинета включена преднастроенная факторная модель оценки вероятности сделки.
            Рекомендуем использовать ее как baseline — при необходимости ее можно изменить в настройках клиента.
          </div>
          <div className="text-xs text-text2">
            Путь: Админ → Парсеры + AI → Парсеры + AI (вкладка) → Факторы скоринга вероятности сделки.
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => nav("/admin/parsers")}>Открыть настройки</Button>
            <Button onClick={acknowledgeScoringModel}>Понятно</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
