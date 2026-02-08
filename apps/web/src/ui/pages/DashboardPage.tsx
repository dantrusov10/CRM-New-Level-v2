import React from "react";
import { TrendingUp, AlertTriangle, CircleDot, Percent, Clock, Users } from "lucide-react";

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
  const dash = (value / 100) * c;
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
        {value}%
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

export function DashboardPage() {
  // Пока: визуальный dashboard-макет под референсы.
  // Данные можно позже подключить из PB (deals, stages, users).
  return (
    <div className="grid gap-6">
      <div className="cockpit-panel p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xl font-extrabold">Dashboard</div>
            <div className="mt-1 text-sm subtle">Сводка пайплайна, динамика и AI-инсайты</div>
          </div>
          <div className="cockpit-glass px-4 py-2 rounded-[18px] text-sm font-bold">
            Период: последние 30 дней
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard title="Pipeline" value="12.05M" icon={TrendingUp} hint="Сумма активных сделок" />
          <StatCard title="Взвешенный" value="7.42M" icon={Percent} hint="С учётом вероятности" />
          <StatCard title="Сделки" value="306" icon={CircleDot} hint="Активные в работе" />
          <StatCard title="Цикл" value="31 д" icon={Clock} hint="Средний срок" />
        </div>

        <div className="mt-6 grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="ui-card p-4 xl:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-extrabold">Динамика входящих</div>
                <div className="text-xs text-text2 mt-1">Новые сделки по неделям</div>
              </div>
              <div className="text-xs text-text2">шт.</div>
            </div>
            <div className="mt-4">
              <MiniBars values={[8, 12, 10, 16, 9, 13, 18, 14]} />
            </div>
          </div>

          <div className="ui-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-extrabold">Win rate</div>
                <div className="text-xs text-text2 mt-1">Закрытие за период</div>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-center">
              <Donut value={42} />
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="ui-card p-4">
            <div className="text-sm font-extrabold">Воронка (узкие места)</div>
            <div className="text-xs text-text2 mt-1">Конверсия между этапами</div>
            <div className="mt-4 space-y-2">
              {[
                { label: "Discovery → КП", v: 68 },
                { label: "КП → Переговоры", v: 44 },
                { label: "Переговоры → Тендер", v: 31 },
                { label: "Тендер → Win", v: 18 },
              ].map((r) => (
                <div key={r.label}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text2">{r.label}</span>
                    <span className="text-text font-bold">{r.v}%</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-[rgba(255,255,255,0.10)] border border-[rgba(255,255,255,0.10)] overflow-hidden">
                    <div
                      style={{
                        width: `${r.v}%`,
                        height: "100%",
                        background: "linear-gradient(90deg, rgba(87,183,255,0.95), rgba(34,211,238,0.55))",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="ui-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-extrabold">Менеджеры</div>
                <div className="text-xs text-text2 mt-1">Активность и результат</div>
              </div>
              <Users size={18} className="text-text2" />
            </div>
            <div className="mt-4 space-y-3">
              {[
                { name: "Иванов", p: 72, deals: 28 },
                { name: "Петров", p: 61, deals: 19 },
                { name: "Сидоров", p: 49, deals: 16 },
              ].map((m) => (
                <div key={m.name} className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold">{m.name}</div>
                    <div className="text-xs text-text2">Сделок: {m.deals}</div>
                  </div>
                  <div className="text-sm font-extrabold">{m.p}%</div>
                </div>
              ))}
            </div>
          </div>

          <div className="ui-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-extrabold">AI Insights</div>
                <div className="text-xs text-text2 mt-1">Риски и точки роста</div>
              </div>
              <AlertTriangle size={18} className="text-text2" />
            </div>
            <div className="mt-4 space-y-3">
              {[
                { title: "3 сделки с высоким риском", desc: "Нет активности > 7 дней" },
                { title: "2 сделки выросли в вероятности", desc: "Появился ЛПР / подтверждение бюджета" },
                { title: "Узкое место: КП → Переговоры", desc: "Конверсия ниже 45%" },
              ].map((x) => (
                <div key={x.title} className="p-3 rounded-[16px] border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.08)]">
                  <div className="text-sm font-extrabold">{x.title}</div>
                  <div className="text-xs text-text2 mt-1">{x.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
