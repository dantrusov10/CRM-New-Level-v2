import React from "react";
import { TrendingUp, AlertTriangle, CircleDot, Percent, Clock, Users, Settings2, SlidersHorizontal, BarChart3 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDeals, useFunnelStages, useUsers } from "../data/hooks";
import { Button } from "../components/Button";
import { Modal } from "../components/Modal";

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

const StatCard = ({
  title,
  value,
  icon: Icon,
  hint,
}: {
  title: string;
  value: string;
  icon: any;
  hint?: string;
}) => (
  <div className="ui-card p-4">
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-xs text-text2 font-semibold">{title}</div>
        <div className="mt-1 text-2xl font-extrabold text-text">{value}</div>
        {hint ? <div className="mt-1 text-xs text-text2">{hint}</div> : null}
      </div>
      <div className="w-10 h-10 rounded-2xl flex items-center justify-center border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.08)]">
        <Icon size={18} className="text-text" />
      </div>
    </div>
  </div>
);

function dealAmount(d: any) {
  const b = Number(d?.budget ?? 0);
  const t = Number(d?.turnover ?? 0);
  return b || t || 0;
}

export function DashboardPage() {
  const nav = useNavigate();
  const stagesQ = useFunnelStages();
  const dealsQ = useDeals(); // uses PB full list (batch) in hooks
  const usersQ = useUsers();

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
    filters: WidgetFilters;
    visual?: "cockpit" | "classic"; // used by some widgets
  };

  type DashCfg = {
    dashboardVisual: "cockpit" | "classic";
    widgets: Record<WidgetId, WidgetCfg>;
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
      statCards: { enabled: true, filters: { ...DEFAULT_WIDGET_FILTERS } },
      dynamics: { enabled: true, filters: { ...DEFAULT_WIDGET_FILTERS } },
      winRate: { enabled: true, filters: { ...DEFAULT_WIDGET_FILTERS } },
      funnel: { enabled: true, filters: { ...DEFAULT_WIDGET_FILTERS }, visual: "cockpit" },
      topManagers: { enabled: true, filters: { ...DEFAULT_WIDGET_FILTERS } },
      insights: { enabled: true, filters: { ...DEFAULT_WIDGET_FILTERS } },
      budgetByStage: { enabled: true, filters: { ...DEFAULT_WIDGET_FILTERS } },
    },
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
        };
      }
      return merged;
    } catch {
      return DEFAULT_CFG;
    }
  }

  const [cfg, setCfg] = React.useState<DashCfg>(() => loadCfg());
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [settingsTarget, setSettingsTarget] = React.useState<WidgetId | "dashboard">("dashboard");

  React.useEffect(() => {
    try {
      localStorage.setItem("nwlvl_dashboard_cfg", JSON.stringify(cfg));
    } catch {}
  }, [cfg]);

  const stages = stagesQ.data ?? [];
  const deals = dealsQ.data ?? [];

  const now = new Date();

  function applyWidgetFilters(input: any[], f: WidgetFilters) {
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
    if (Number.isFinite(f.budgetMin as any)) arr = arr.filter((d) => Number(d?.budget ?? 0) >= Number(f.budgetMin));
    if (Number.isFinite(f.budgetMax as any)) arr = arr.filter((d) => Number(d?.budget ?? 0) <= Number(f.budgetMax));
    if (Number.isFinite(f.scoreMin as any)) arr = arr.filter((d) => Number(d?.current_score ?? 0) >= Number(f.scoreMin));
    if (Number.isFinite(f.scoreMax as any)) arr = arr.filter((d) => Number(d?.current_score ?? 0) <= Number(f.scoreMax));
    return { arr, from };
  }

  function drillToDeals(filters: WidgetFilters & { stageId?: string }) {
    // IMPORTANT: deals page supports PB server-side filters only.
    // We pass only fields that реально существуют в коллекции deals.
    const sp = new URLSearchParams();
    if (filters.stageId) sp.set("stage", String(filters.stageId));
    if (filters.ownerId) sp.set("owner", String(filters.ownerId));
    if (filters.channel) sp.set("channel", String(filters.channel));
    if (Number.isFinite(filters.budgetMin as any)) sp.set("budgetMin", String(filters.budgetMin));
    if (Number.isFinite(filters.budgetMax as any)) sp.set("budgetMax", String(filters.budgetMax));
    if (Number.isFinite(filters.scoreMin as any)) sp.set("scoreMin", String(filters.scoreMin));
    if (Number.isFinite(filters.scoreMax as any)) sp.set("scoreMax", String(filters.scoreMax));
    // time range as "from" (YYYY-MM-DD)
    const from = new Date(now.getTime() - (Number(filters.rangeDays) || 30) * 24 * 60 * 60 * 1000);
    sp.set("from", from.toISOString());
    nav(`/deals?${sp.toString()}`);
  }

  function computeStats(list: any[]) {
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

  function computeDynamics(list: any[]) {
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
  function computeWinRateVariant2(list: any[], from: Date) {
    const stageById = new Map<string, any>();
    (stages as any[]).forEach((s) => stageById.set(String(s.id), s));

    const classifyFinal = (stage: any): "won" | "lost" | "none" => {
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

  function stageTable(list: any[]) {
    const by: Record<string, { name: string; count: number; sum: number }> = {};
    for (const s of stages as any[]) {
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

  function topManagersTable(list: any[]) {
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

  const loading = stagesQ.isLoading || dealsQ.isLoading || usersQ.isLoading;

  const pageWrapperClass = cfg.dashboardVisual === "classic" ? "rounded-card border border-border bg-white p-6" : "cockpit-panel p-6";

  const openDashboardSettings = () => {
    setSettingsTarget("dashboard");
    setSettingsOpen(true);
  };

  const openWidgetSettings = (id: WidgetId) => {
    setSettingsTarget(id);
    setSettingsOpen(true);
  };

  function WidgetFrame({
    title,
    subtitle,
    widgetId,
    children,
    onDrill,
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
            {onDrill ? (
              <button
                className="h-9 w-9 rounded-2xl border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.08)] flex items-center justify-center"
                title="Провалиться в сделки"
                onClick={onDrill}
              >
                <SlidersHorizontal size={16} className="text-text" />
              </button>
            ) : null}
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

  const dealsAll = (deals as any[]) ?? [];

  // Widget data (computed once per render; deals list is capped)
  const wStat = applyWidgetFilters(dealsAll, cfg.widgets.statCards.filters);
  const sStat = computeStats(wStat.arr);

  const wDyn = applyWidgetFilters(dealsAll, cfg.widgets.dynamics.filters);
  const dynBars = computeDynamics(wDyn.arr);

  const wWR = applyWidgetFilters(dealsAll, cfg.widgets.winRate.filters);
  const wr2 = computeWinRateVariant2(wWR.arr, wWR.from);

  const wFunnel = applyWidgetFilters(dealsAll, cfg.widgets.funnel.filters);
  const funnelRows = stageTable(wFunnel.arr);

  const wBudget = applyWidgetFilters(dealsAll, cfg.widgets.budgetByStage.filters);
  const budgetRows = stageTable(wBudget.arr);
  const maxBudget = Math.max(1, ...budgetRows.map((r) => r.sum));

  const wManagers = applyWidgetFilters(dealsAll, cfg.widgets.topManagers.filters);
  const managers = topManagersTable(wManagers.arr);

  const wInsights = applyWidgetFilters(dealsAll, cfg.widgets.insights.filters);
  const ins = insightsFromStats(computeStats(wInsights.arr));

  return (
    <div className="grid gap-6">
      <div className={pageWrapperClass}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xl font-extrabold">Dashboard</div>
            <div className="mt-1 text-sm subtle">Каждый блок настраивается отдельно (период/фильтры) + есть проваливание в сделки</div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={openDashboardSettings} className="h-10">
              <span className="inline-flex items-center gap-2"><BarChart3 size={16} /> Настройки дашборда</span>
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="mt-6 text-sm text-text2">Загрузка данных...</div>
        ) : (
          <>
            {/* STAT CARDS */}
            {cfg.widgets.statCards.enabled ? (
              <div className="mt-6">
                <WidgetFrame
                  title="Ключевые метрики"
                  subtitle={`Период: последние ${cfg.widgets.statCards.filters.rangeDays || 30} дней`}
                  widgetId="statCards"
                  onDrill={() => drillToDeals(cfg.widgets.statCards.filters)}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    <StatCard title="Pipeline" value={`${money(sStat.pipeline)} ₽`} icon={TrendingUp} hint="Сумма активных сделок (budget/turnover)" />
                    <StatCard title="Взвешенный" value={`${money(sStat.weighted)} ₽`} icon={Percent} hint="С учётом current_score" />
                    <StatCard title="Сделки" value={`${sStat.dealsCount}`} icon={CircleDot} hint="По фильтрам виджета" />
                    <StatCard title="Цикл" value={`${sStat.cycle} д`} icon={Clock} hint="Средний (created→updated), MVP" />
                  </div>
                </WidgetFrame>
              </div>
            ) : null}

            {/* DYNAMICS + WINRATE */}
            <div className="mt-6 grid grid-cols-1 xl:grid-cols-3 gap-4">
              {cfg.widgets.dynamics.enabled ? (
                <WidgetFrame
                  title="Динамика входящих"
                  subtitle="Новые сделки по неделям (8 недель)"
                  widgetId="dynamics"
                  onDrill={() => drillToDeals(cfg.widgets.dynamics.filters)}
                >
                  <MiniBars values={dynBars} />
                </WidgetFrame>
              ) : null}

              {cfg.widgets.winRate.enabled ? (
                <WidgetFrame
                  title="Win rate"
                  subtitle={`Вариант 2: won/(won+lost) за ${cfg.widgets.winRate.filters.rangeDays || 30} дней`}
                  widgetId="winRate"
                  onDrill={() => drillToDeals(cfg.widgets.winRate.filters)}
                >
                  <div className="flex items-center justify-center">
                    <div>
                      <div className="flex items-center justify-center"><Donut value={wr2.rate} /></div>
                      <div className="mt-2 text-xs text-text2 text-center">Won: {wr2.won} · Lost: {wr2.lost}</div>
                    </div>
                  </div>
                </WidgetFrame>
              ) : null}
            </div>

            {/* FUNNEL + BUDGET BY STAGE */}
            <div className="mt-6 grid grid-cols-1 xl:grid-cols-3 gap-4">
              {cfg.widgets.funnel.enabled ? (
                <WidgetFrame
                  title="Воронка"
                  subtitle="Количество и сумма по этапам (клик по этапу → сделки)"
                  widgetId="funnel"
                  onDrill={() => drillToDeals(cfg.widgets.funnel.filters)}
                >
                  {cfg.widgets.funnel.visual === "classic" ? (
                    <div className="overflow-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-text2">
                            <th className="py-2">Этап</th>
                            <th className="py-2 text-right">Сделок</th>
                            <th className="py-2 text-right">Сумма</th>
                          </tr>
                        </thead>
                        <tbody>
                          {funnelRows.map((r) => (
                            <tr
                              key={r.id}
                              className="border-t border-[rgba(255,255,255,0.10)] hover:bg-[rgba(255,255,255,0.06)] cursor-pointer"
                              onClick={() => drillToDeals({ ...cfg.widgets.funnel.filters, stageId: r.id })}
                            >
                              <td className="py-2 font-semibold">{r.name}</td>
                              <td className="py-2 text-right">{r.count}</td>
                              <td className="py-2 text-right">{money(r.sum)} ₽</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {funnelRows.map((r) => (
                        <button
                          key={r.id}
                          className="w-full text-left p-3 rounded-[16px] border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.10)]"
                          onClick={() => drillToDeals({ ...cfg.widgets.funnel.filters, stageId: r.id })}
                        >
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-extrabold">{r.name}</div>
                            <div className="text-sm font-extrabold">{r.count}</div>
                          </div>
                          <div className="text-xs text-text2 mt-1">Сумма: {money(r.sum)} ₽</div>
                        </button>
                      ))}
                    </div>
                  )}
                </WidgetFrame>
              ) : null}

              {cfg.widgets.budgetByStage.enabled ? (
                <WidgetFrame
                  title="Бюджет по этапам"
                  subtitle="Горизонтальные бары по сумме (клик → сделки)"
                  widgetId="budgetByStage"
                  onDrill={() => drillToDeals(cfg.widgets.budgetByStage.filters)}
                >
                  <div className="space-y-2">
                    {budgetRows.map((r) => (
                      <button
                        key={r.id}
                        className="w-full text-left"
                        onClick={() => drillToDeals({ ...cfg.widgets.budgetByStage.filters, stageId: r.id })}
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold">{r.name}</span>
                          <span className="text-text2">{money(r.sum)} ₽</span>
                        </div>
                        <div className="mt-1 h-2 rounded-full bg-[rgba(255,255,255,0.10)] overflow-hidden">
                          <div
                            className="h-2 rounded-full"
                            style={{ width: `${Math.round((r.sum / maxBudget) * 100)}%`, background: "linear-gradient(90deg, rgba(87,183,255,0.95), rgba(44,158,255,0.38))" }}
                          />
                        </div>
                      </button>
                    ))}
                  </div>
                </WidgetFrame>
              ) : null}

              {cfg.widgets.topManagers.enabled ? (
                <WidgetFrame
                  title="Менеджеры"
                  subtitle="Топ по пайплайну (клик → сделки)"
                  widgetId="topManagers"
                  onDrill={() => drillToDeals(cfg.widgets.topManagers.filters)}
                >
                  <div className="space-y-3">
                    {managers.length ? (
                      managers.map((m) => (
                        <button
                          key={m.id}
                          className="w-full flex items-center justify-between hover:bg-[rgba(255,255,255,0.06)] rounded-[14px] p-2"
                          onClick={() => drillToDeals({ ...cfg.widgets.topManagers.filters, ownerId: m.id })}
                        >
                          <div>
                            <div className="text-sm font-bold">{m.name}</div>
                            <div className="text-xs text-text2">Сделок: {m.deals}</div>
                          </div>
                          <div className="text-sm font-extrabold">{money(m.pipeline)} ₽</div>
                        </button>
                      ))
                    ) : (
                      <div className="text-sm text-text2">Нет данных по ответственным</div>
                    )}
                  </div>
                </WidgetFrame>
              ) : null}
            </div>

            {/* INSIGHTS */}
            {cfg.widgets.insights.enabled ? (
              <div className="mt-6">
                <WidgetFrame
                  title="Insights"
                  subtitle="Быстрые сигналы по данным"
                  widgetId="insights"
                  onDrill={() => drillToDeals(cfg.widgets.insights.filters)}
                >
                  <div className="space-y-3">
                    {ins.map((x) => (
                      <div key={x.title} className="p-3 rounded-[16px] border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.08)]">
                        <div className="text-sm font-extrabold">{x.title}</div>
                        <div className="text-xs text-text2 mt-1">{x.desc}</div>
                      </div>
                    ))}
                  </div>
                </WidgetFrame>
              </div>
            ) : null}
          </>
        )}
      </div>

      <Modal
        open={settingsOpen}
        title={settingsTarget === "dashboard" ? "Настройка дашборда" : `Настройка виджета: ${settingsTarget}`}
        onClose={() => setSettingsOpen(false)}
        widthClass="max-w-2xl"
      >
        {settingsTarget === "dashboard" ? (
          <div className="grid gap-4">
            <div>
              <div className="text-xs text-text2 mb-1">Стиль дашборда</div>
              <select
                className="h-10 w-full rounded-card border border-[#9CA3AF] bg-white px-3 text-sm"
                value={cfg.dashboardVisual}
                onChange={(e) => setCfg((p) => ({ ...p, dashboardVisual: e.target.value as any }))}
              >
                <option value="cockpit">Cockpit (glass)</option>
                <option value="classic">Classic</option>
              </select>
            </div>

            <div>
              <div className="text-xs text-text2 mb-2">Виджеты (вкл/выкл)</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {(
                  [
                    ["statCards", "Ключевые метрики"],
                    ["dynamics", "Динамика входящих"],
                    ["winRate", "Win rate"],
                    ["funnel", "Воронка"],
                    ["budgetByStage", "Бюджет по этапам"],
                    ["topManagers", "Менеджеры"],
                    ["insights", "Insights"],
                  ] as Array<[WidgetId, string]>
                ).map(([key, label]) => (
                  <label key={String(key)} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={cfg.widgets[key].enabled}
                      onChange={(e) => setCfg((p) => ({ ...p, widgets: { ...p.widgets, [key]: { ...p.widgets[key], enabled: e.target.checked } } }))}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setCfg(DEFAULT_CFG)}>Сбросить всё</Button>
              <Button onClick={() => setSettingsOpen(false)}>Готово</Button>
            </div>
          </div>
        ) : (
          (() => {
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
                        onChange={(e) => setCfg((p) => ({ ...p, widgets: { ...p.widgets, funnel: { ...p.widgets.funnel, visual: e.target.value as any } } }))}
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

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <div className="text-xs text-text2 mb-1">Этап</div>
                    <select
                      className="h-10 w-full rounded-card border border-[#9CA3AF] bg-white px-3 text-sm"
                      value={f.stageId ?? ""}
                      onChange={(e) => setFilters({ stageId: e.target.value })}
                    >
                      <option value="">Все этапы</option>
                      {(stagesQ.data ?? []).map((s: any) => (
                        <option key={s.id} value={s.id}>{s.stage_name ?? "Этап"}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className="text-xs text-text2 mb-1">Ответственный</div>
                    <select
                      className="h-10 w-full rounded-card border border-[#9CA3AF] bg-white px-3 text-sm"
                      value={f.ownerId ?? ""}
                      onChange={(e) => setFilters({ ownerId: e.target.value })}
                    >
                      <option value="">Все</option>
                      {(usersQ.data ?? []).map((u: any) => (
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
                        } as any,
                      }));
                    }}
                  >
                    Сбросить виджет
                  </Button>
                  <Button onClick={() => setSettingsOpen(false)}>Готово</Button>
                </div>
              </div>
            );
          })()
        )}
      </Modal>
    </div>
  );
}
