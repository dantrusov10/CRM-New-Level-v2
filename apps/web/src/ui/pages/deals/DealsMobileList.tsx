import React from "react";
import type { Deal } from "../../../lib/types";
import { Badge } from "../../components/Badge";

function money(n: number) {
  if (!Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString("ru-RU");
}

function dealAmount(d: Deal) {
  const b = Number(d.budget ?? 0);
  const t = Number(d.turnover ?? 0);
  return b || t || 0;
}

export function DealsMobileList({
  items,
  onOpen,
}: {
  items: Deal[];
  onOpen: (id: string) => void;
}) {
  if (!items.length) {
    return <div className="text-sm text-text2 py-4 md:hidden">Сделок нет</div>;
  }
  return (
    <div className="grid gap-2 md:hidden">
      {items.map((d) => {
        const company =
          (d as Deal & { expand?: { company_id?: { name?: string } } }).expand?.company_id?.name || "—";
        const stage =
          (d as Deal & { expand?: { stage_id?: { stage_name?: string } } }).expand?.stage_id?.stage_name || "—";
        const score = Number(d.current_score ?? 0);
        return (
          <button
            key={d.id}
            type="button"
            className="text-left rounded-card border border-border bg-[rgba(255,255,255,0.06)] p-3 active:bg-[rgba(51,215,255,0.12)]"
            onClick={() => onOpen(String(d.id))}
          >
            <div className="font-semibold text-sm line-clamp-2">{d.title || "Без названия"}</div>
            <div className="text-xs text-text2 mt-1">{company}</div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <Badge>{stage}</Badge>
              {score > 0 ? <span className="text-primary font-semibold">AI {score}%</span> : null}
              <span className="text-text2">{money(dealAmount(d))} ₽</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
