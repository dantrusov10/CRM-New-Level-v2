import React from "react";
import type { FunnelStage } from "../../../../lib/types";
import { useDroppable } from "@dnd-kit/core";
import { KanbanCard } from "./KanbanCard";

function money(n: number) {
  return n.toLocaleString("ru-RU");
}

export function KanbanColumn({
  stage,
  deals,
  stats,
}: {
  stage: FunnelStage;
  deals: any[];
  stats?: { count: number; sum: number };
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  const name = (stage as any).stage_name ?? (stage as any).name;

  return (
    <div
      ref={setNodeRef}
      className="rounded-card border border-border bg-tableHeader p-3"
      style={{ outline: isOver ? "2px solid #004EEB" : "none" }}
    >
      <div className="flex items-start justify-between mb-3 gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-text truncate">{name}</div>
          <div className="text-xs text-text2 mt-0.5">
            {(stats?.count ?? deals.length)} • {money(stats?.sum ?? 0)} ₽
          </div>
        </div>
        <div className="text-xs text-text2 tabular-nums">{deals.length}</div>
      </div>

      <div className="grid gap-2">
        {deals.map((d) => (
          <KanbanCard key={d.id} deal={d} stageColor={(stage as any).color ?? "#004EEB"} />
        ))}
      </div>
    </div>
  );
}
