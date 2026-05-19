import React from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const CYAN = "rgba(87,183,255,0.95)";
const CYAN_SOFT = "rgba(44,158,255,0.55)";
const TOOLTIP_STYLE: React.CSSProperties = {
  background: "rgba(7,26,51,0.96)",
  border: "1px solid rgba(51,215,255,0.35)",
  borderRadius: 10,
  color: "rgba(236,244,255,0.95)",
  fontSize: 12,
};

export function DynamicsBarChart({ values }: { values: number[] }) {
  const data = values.map((v, i) => ({ week: `Н-${values.length - i}`, count: v }));
  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
        <XAxis dataKey="week" tick={{ fill: "rgba(177,194,218,0.9)", fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis allowDecimals={false} tick={{ fill: "rgba(177,194,218,0.75)", fontSize: 10 }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(v) => [`${Number(v ?? 0)} сделок`, "Новые"]}
          labelStyle={{ color: "rgba(177,194,218,0.9)" }}
        />
        <Bar dataKey="count" radius={[6, 6, 0, 0]} fill={CYAN} stroke="rgba(255,255,255,0.12)" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function WinRateDonutChart({ rate, won, lost }: { rate: number; won: number; lost: number }) {
  const clamped = Math.max(0, Math.min(100, rate));
  const data = [
    { name: "Победы", value: clamped },
    { name: "Остальное", value: 100 - clamped },
  ];
  return (
    <div className="flex flex-col items-center">
      <ResponsiveContainer width={140} height={140}>
        <PieChart>
          <Pie data={data} dataKey="value" innerRadius={42} outerRadius={56} startAngle={90} endAngle={-270} stroke="none">
            <Cell fill={CYAN} />
            <Cell fill="rgba(255,255,255,0.10)" />
          </Pie>
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, name) => [`${Math.round(Number(v ?? 0))}%`, String(name)]} />
        </PieChart>
      </ResponsiveContainer>
      <div className="text-lg font-extrabold text-text -mt-[92px] mb-10 pointer-events-none">{Math.round(clamped)}%</div>
      <div className="text-xs text-text2 text-center">Won: {won} · Lost: {lost}</div>
    </div>
  );
}

export function BudgetByStageChart({
  rows,
  maxSum,
  onStageClick,
}: {
  rows: { id: string; name: string; sum: number }[];
  maxSum: number;
  onStageClick: (id: string) => void;
}) {
  const data = rows.map((r) => ({ name: r.name, sum: r.sum, id: r.id }));
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, rows.length * 36)}>
      <BarChart layout="vertical" data={data} margin={{ top: 4, right: 12, left: 4, bottom: 4 }}>
        <XAxis type="number" hide domain={[0, maxSum]} />
        <YAxis type="category" dataKey="name" width={110} tick={{ fill: "rgba(177,194,218,0.9)", fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(v) => [`${Math.round(Number(v ?? 0)).toLocaleString("ru-RU")} ₽`, "Сумма"]}
        />
        <Bar
          dataKey="sum"
          radius={[0, 6, 6, 0]}
          fill={CYAN}
          stroke={CYAN_SOFT}
          className="cursor-pointer"
          onClick={(_data, index) => {
            const row = rows[index];
            if (row) onStageClick(row.id);
          }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
