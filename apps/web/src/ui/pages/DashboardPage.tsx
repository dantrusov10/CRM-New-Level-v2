import React from "react";
import { TrendingUp, AlertTriangle, CircleDot, Percent, Clock, Users, Settings2 } from "lucide-react";
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
  const stagesQ = useFunnelStages();
  const dealsQ = useDeals(); // uses PB full list (batch) in hooks
  const usersQ = useUsers();

  type DashCfg = {
    rangeDays: number;
    stageId: string;
    ownerId: string;
    channel: string;
    visual: "cockpit" | "classic";
    widgets: {
      statCards: boolean;
      dynamics: boolean;
      winRate: boolean;
      funnel: boolean;
      topManagers: boolean;
      insights: boolean;
    };
  };

  const DEFAULT_CFG: DashCfg = {
    rangeDays: 30,
    stageId: "",
    ownerId: "",
    channel: "",
    visual: "cockpit",
    widgets: {
      statCards: true,
      dynamics: true,
      winRate: true,
      funnel: true,
      topManagers: true,
      insights: true,
    },
  };

  function loadCfg(): DashCfg {
    try {
      const raw = localStorage.getItem("nwlvl_dashboard_cfg");
      if (!raw) return DEFAULT_CFG;
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_CFG,
        ...parsed,
        widgets: { ...DEFAULT_CFG.widgets, ...(parsed?.widgets ?? {}) },
      };
    } catch {
      return DEFAULT_CFG;
    }
  }

  const [cfg, setCfg] = React.useState<DashCfg>(() => loadCfg());
  const [settingsOpen, setSettingsOpen] = React.useState(false);

  React.useEffect(() => {
    try {
      localStorage.setItem("nwlvl_dashboard_cfg", JSON.stringify(cfg));
    } catch {}
  }, [cfg]);

  const stages = stagesQ.data ?? [];
  const deals = dealsQ.data ?? [];

  const now = new Date();
  const rangeFrom = new Date(now.getTime() - (cfg.rangeDays || 30) * 24 * 60 * 60 * 1000);

  const filteredDeals = React.useMemo(() => {
    let arr = (deals as any[]) ?? [];
    // time range (created)
    if (cfg.rangeDays && cfg.rangeDays > 0) {
      arr = arr.filter((d) => {
        const c = d?.created ? new Date(d.created) : null;
        return c && c >= rangeFrom;
      });
    }
    if (cfg.stageId) {
      arr = arr.filter((d) => (d.stage_id ?? d.expand?.stage_id?.id) === cfg.stageId);
    }
    if (cfg.ownerId) {
      arr = arr.filter((d) => (d.responsible_id ?? d.expand?.responsible_id?.id) === cfg.ownerId);
    }
    if (cfg.channel) {
      arr = arr.filter((d) => String(d.sales_channel ?? "") === cfg.channel);
    }
    return arr;
  }, [deals, cfg.rangeDays, cfg.stageId, cfg.ownerId, cfg.channel, rangeFrom]);

  const stats = React.useMemo(() => {
    const all = filteredDeals as any[];

    const pipeline = all.reduce((acc, d) => acc + dealAmount(d), 0);
    const weighted = all.reduce((acc, d) => {
      const score = Number(d?.current_score ?? 0);
      const w = score > 0 ? score / 100 : 0;
      return acc + dealAmount(d) * w;
    }, 0);

    // cycle length: avg days from created to updated for active deals (approx MVP)
    const cycleDaysArr = all
      .map((d) => {
        const c = d?.created ? new Date(d.created) : null;
        const u = d?.updated ? new Date(d.updated) : null;
        if (!c || !u) return null;
        return daysBetween(c, u);
      })
      .filter((x) => typeof x === "number") as number[];
    const cycle = cycleDaysArr.length ? Math.round(cycleDaysArr.reduce((a, b) => a + b, 0) / cycleDaysArr.length) : 0;

    // created dynamics: last 8 weeks
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

    // win rate: if stage has is_final=true (and maybe stage_name contains win/успех) - MVP heuristic
    const finalStageIds = new Set(stages.filter((s: any) => Boolean((s as any).is_final)).map((s: any) => s.id));
    const finals = all.filter((d) => finalStageIds.has(d.stage_id ?? d.expand?.stage_id?.id));
    const created30 = all; // already filtered by range
    const finals30 = finals.filter((d) => {
      const u = d?.updated ? new Date(d.updated) : null;
      return u && u >= rangeFrom;
    });
    const winRate = created30.length ? (finals30.length / created30.length) * 100 : 0;

    // risks
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
      bars: buckets,
      winRate,
      riskStale: stale.length,
      riskNoBudget: noBudget.length,
      riskNoCompany: noCompany.length,
    };
  }, [deals, stages]);

  const stageBreakdown = React.useMemo(() => {
    const by: Record<string, { name: string; count: number; sum: number }> = {};
    for (const s of stages as any[]) {
      by[s.id] = { name: String(s.stage_name ?? "Этап"), count: 0, sum: 0 };
    }
    for (const d of filteredDeals as any[]) {
      const sid = d.stage_id ?? d.expand?.stage_id?.id;
      if (!sid || !by[sid]) continue;
      by[sid].count += 1;
      by[sid].sum += dealAmount(d);
    }
    return Object.entries(by)
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredDeals, stages]);

  const topManagers = React.useMemo(() => {
    // MVP: group by responsible_id (expand)
    const m: Record<string, { name: string; deals: number; pipeline: number }> = {};
    for (const d of filteredDeals as any[]) {
      const rid = d.responsible_id ?? d.expand?.responsible_id?.id;
      if (!rid) continue;
      const name = d.expand?.responsible_id?.name || d.expand?.responsible_id?.email || "Менеджер";
      if (!m[rid]) m[rid] = { name, deals: 0, pipeline: 0 };
      m[rid].deals += 1;
      m[rid].pipeline += dealAmount(d);
    }
    return Object.values(m)
      .sort((a, b) => b.pipeline - a.pipeline)
      .slice(0, 5);
  }, [filteredDeals]);

  const aiInsights = React.useMemo(() => {
    // Пока без отдельной коллекции AI: формируем полезные подсказки из данных
    const items: { title: string; desc: string }[] = [];

    if (stats.riskStale > 0) items.push({ title: `${stats.riskStale} сделок без активности`, desc: "Не обновлялись 7+ дней" });
    if (stats.riskNoBudget > 0) items.push({ title: `${stats.riskNoBudget} сделок без бюджета`, desc: "Нельзя посчитать pipeline корректно" });
    if (stats.riskNoCompany > 0) items.push({ title: `${stats.riskNoCompany} сделок без компании`, desc: "Проверьте связь deal → company" });

    if (!items.length) items.push({ title: "Риски не обнаружены", desc: "Всё выглядит аккуратно по базовым сигналам" });
    return items.slice(0, 3);
  }, [stats]);

  const loading = stagesQ.isLoading || dealsQ.isLoading;

  return (
    <div className="grid gap-6">
      <div className={cfg.visual === "classic" ? "rounded-card border border-border bg-white p-6" : "cockpit-panel p-6"}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xl font-extrabold">Dashboard</div>
            <div className="mt-1 text-sm subtle">Сводка пайплайна, динамика и инсайты</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="cockpit-glass px-4 py-2 rounded-[18px] text-sm font-bold">Период: последние {cfg.rangeDays || 30} дней</div>
            <Button variant="secondary" onClick={() => setSettingsOpen(true)} className="h-10">
              <span className="inline-flex items-center gap-2"><Settings2 size={16} /> Настроить</span>
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="mt-6 text-sm text-text2">Загрузка данных...</div>
        ) : (
          <>
            {cfg.widgets.statCards ? (
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <StatCard title="Pipeline" value={`${money(stats.pipeline)} ₽`} icon={TrendingUp} hint="Сумма активных сделок (budget/turnover)" />
                <StatCard title="Взвешенный" value={`${money(stats.weighted)} ₽`} icon={Percent} hint="С учётом current_score" />
                <StatCard title="Сделки" value={`${stats.dealsCount}`} icon={CircleDot} hint="Всего в системе" />
                <StatCard title="Цикл" value={`${stats.cycle} д`} icon={Clock} hint="Средний (created→updated), MVP" />
              </div>
            ) : null}

            {(cfg.widgets.dynamics || cfg.widgets.winRate) ? (
            <div className="mt-6 grid grid-cols-1 xl:grid-cols-3 gap-4">
              {cfg.widgets.dynamics ? (
              <div className="ui-card p-4 xl:col-span-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-extrabold">Динамика входящих</div>
                    <div className="text-xs text-text2 mt-1">Новые сделки по неделям (8 недель)</div>
                  </div>
                  <div className="text-xs text-text2">шт.</div>
                </div>
                <div className="mt-4">
                  <MiniBars values={stats.bars} />
                </div>
              </div>
              ) : null}

              {cfg.widgets.winRate ? (
              <div className="ui-card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-extrabold">Win rate</div>
                    <div className="text-xs text-text2 mt-1">По финальным этапам за {cfg.rangeDays || 30} дней</div>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-center">
                  <Donut value={stats.winRate} />
                </div>
              </div>
              ) : null}
            </div>
            ) : null}

            {(cfg.widgets.funnel || cfg.widgets.topManagers || cfg.widgets.insights) ? (
            <div className="mt-6 grid grid-cols-1 xl:grid-cols-3 gap-4">
              {cfg.widgets.funnel ? (
              <div className="ui-card p-4">
                <div className="text-sm font-extrabold">Воронка</div>
                <div className="text-xs text-text2 mt-1">Количество и сумма по этапам</div>

                {cfg.visual === "classic" ? (
                  <div className="mt-4 overflow-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-text2">
                          <th className="py-2">Этап</th>
                          <th className="py-2 text-right">Сделок</th>
                          <th className="py-2 text-right">Сумма</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stageBreakdown.map((r) => (
                          <tr key={r.id} className="border-t border-[rgba(255,255,255,0.10)]">
                            <td className="py-2">{r.name}</td>
                            <td className="py-2 text-right">{r.count}</td>
                            <td className="py-2 text-right">{money(r.sum)} ₽</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {stageBreakdown.map((r) => (
                      <div key={r.id} className="p-3 rounded-[16px] border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.08)]">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-extrabold">{r.name}</div>
                          <div className="text-sm font-extrabold">{r.count}</div>
                        </div>
                        <div className="text-xs text-text2 mt-1">Сумма: {money(r.sum)} ₽</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              ) : null}

              {cfg.widgets.topManagers ? (
              <div className="ui-card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-extrabold">Менеджеры</div>
                    <div className="text-xs text-text2 mt-1">Топ по пайплайну</div>
                  </div>
                  <Users size={18} className="text-text2" />
                </div>
                <div className="mt-4 space-y-3">
                  {topManagers.length ? (
                    topManagers.map((m) => (
                      <div key={m.name} className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-bold">{m.name}</div>
                          <div className="text-xs text-text2">Сделок: {m.deals}</div>
                        </div>
                        <div className="text-sm font-extrabold">{money(m.pipeline)} ₽</div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-text2">Нет данных по ответственным</div>
                  )}
                </div>
              </div>
              ) : null}

              {cfg.widgets.insights ? (
              <div className="ui-card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-extrabold">Insights</div>
                    <div className="text-xs text-text2 mt-1">Быстрые сигналы по данным</div>
                  </div>
                  <AlertTriangle size={18} className="text-text2" />
                </div>
                <div className="mt-4 space-y-3">
                  {aiInsights.map((x) => (
                    <div key={x.title} className="p-3 rounded-[16px] border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.08)]">
                      <div className="text-sm font-extrabold">{x.title}</div>
                      <div className="text-xs text-text2 mt-1">{x.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
              ) : null}
            </div>
            ) : null}
          </>
        )}
      </div>

      <Modal open={settingsOpen} title="Настройка дашборда" onClose={() => setSettingsOpen(false)} widthClass="max-w-2xl">
        <div className="grid gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-text2 mb-1">Визуал воронки</div>
              <select className="h-10 w-full rounded-card border border-[#9CA3AF] bg-white px-3 text-sm" value={cfg.visual} onChange={(e) => setCfg((p) => ({ ...p, visual: e.target.value as any }))}>
                <option value="cockpit">Карточки (neon)</option>
                <option value="classic">Таблица (classic)</option>
              </select>
            </div>

            <div>
              <div className="text-xs text-text2 mb-1">Период</div>
              <select className="h-10 w-full rounded-card border border-[#9CA3AF] bg-white px-3 text-sm" value={String(cfg.rangeDays)} onChange={(e) => setCfg((p) => ({ ...p, rangeDays: Number(e.target.value) }))}>
                <option value="7">Последние 7 дней</option>
                <option value="30">Последние 30 дней</option>
                <option value="90">Последние 90 дней</option>
                <option value="365">Последний год</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <div className="text-xs text-text2 mb-1">Фильтр: этап</div>
              <select className="h-10 w-full rounded-card border border-[#9CA3AF] bg-white px-3 text-sm" value={cfg.stageId} onChange={(e) => setCfg((p) => ({ ...p, stageId: e.target.value }))}>
                <option value="">Все этапы</option>
                {(stagesQ.data ?? []).map((s: any) => (
                  <option key={s.id} value={s.id}>{s.stage_name ?? "Этап"}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="text-xs text-text2 mb-1">Фильтр: ответственный</div>
              <select className="h-10 w-full rounded-card border border-[#9CA3AF] bg-white px-3 text-sm" value={cfg.ownerId} onChange={(e) => setCfg((p) => ({ ...p, ownerId: e.target.value }))}>
                <option value="">Все</option>
                {(usersQ.data ?? []).map((u: any) => (
                  <option key={u.id} value={u.id}>{u.name ?? u.email}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="text-xs text-text2 mb-1">Фильтр: канал</div>
              <input className="h-10 w-full rounded-card border border-[#9CA3AF] bg-white px-3 text-sm" value={cfg.channel} onChange={(e) => setCfg((p) => ({ ...p, channel: e.target.value }))} placeholder='например: партнерский' />
            </div>
          </div>

          <div>
            <div className="text-xs text-text2 mb-2">Виджеты</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {(
                [
                  ["statCards", "Карточки метрик"],
                  ["dynamics", "Динамика входящих"],
                  ["winRate", "Win rate"],
                  ["funnel", "Воронка"],
                  ["topManagers", "Менеджеры"],
                  ["insights", "Insights"],
                ] as Array<[keyof DashCfg["widgets"], string]>
              ).map(([key, label]) => (
                <label key={String(key)} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={cfg.widgets[key]} onChange={(e) => setCfg((p) => ({ ...p, widgets: { ...p.widgets, [key]: e.target.checked } }))} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setCfg(DEFAULT_CFG)}>Сбросить</Button>
            <Button onClick={() => setSettingsOpen(false)}>Готово</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
