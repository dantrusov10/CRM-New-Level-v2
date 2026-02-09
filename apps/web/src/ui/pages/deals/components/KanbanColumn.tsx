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
      className="rounded-card border border-border bg-tableHeader p-3 overflow-hidden"
      style={{
        outline: isOver ? `2px solid ${(stage as any).color ?? "#33D7FF"}` : "none",
        boxShadow: isOver ? `0 0 0 1px rgba(255,255,255,0.12) inset, 0 0 28px ${(stage as any).color ?? "#33D7FF"}` : undefined,
      }}
    >
      <div className="flex items-start justify-between mb-3 gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{
                background: (stage as any).color ?? "#33D7FF",
                boxShadow: `0 0 14px ${(stage as any).color ?? "#33D7FF"}`,
              }}
            />
            <div className="text-sm font-semibold text-text truncate">{name}</div>
          </div>
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
