import React from "react";
import type { Deal, FunnelStage } from "../../../../lib/types";
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
  deals: Deal[];
  stats?: { count: number; sum: number };
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  const name = stage.stage_name ?? "Этап";

  return (
    <div
      ref={setNodeRef}
      data-kanban-column="true"
      className="rounded-card border border-border bg-[rgba(12,31,60,0.62)] p-3 overflow-hidden flex flex-col backdrop-blur-[10px]"
      style={{
        outline: isOver ? `2px solid ${stage.color ?? "#33D7FF"}` : "none",
        boxShadow: isOver ? `0 0 0 1px rgba(255,255,255,0.12) inset, 0 0 28px ${stage.color ?? "#33D7FF"}` : undefined,
      }}
    >
      <div className="flex items-start justify-between mb-3 gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{
                background: stage.color ?? "#33D7FF",
                boxShadow: `0 0 14px ${stage.color ?? "#33D7FF"}`,
              }}
            />
            <div className="text-sm font-semibold text-text truncate">{name}</div>
          </div>
          <div className="text-xs text-text2 mt-0.5">
            {(stats?.count ?? deals.length)} сделок • {money(stats?.sum ?? 0)} ₽
          </div>
        </div>
        <div className="text-xs text-text2 tabular-nums rounded-full border border-border px-2 py-0.5 bg-[rgba(255,255,255,0.06)]">{deals.length}</div>
      </div>

      {/*
        IMPORTANT:
        Don't use CSS grid for the cards list.
        When the column is tall (flex-1), CSS grid can stretch rows to fill
        the available height. As a result, in columns with fewer deals the
        cards become "толще" (higher) and the UI looks inconsistent and jerky.
        A simple flex-column keeps each card the same height regardless of
        the number of items in the stage.
      */}
      <div className="flex flex-col gap-2 flex-1 min-h-[140px] justify-start">
        {deals.map((d) => (
          <KanbanCard key={d.id} deal={d} stageColor={stage.color ?? "#004EEB"} />
        ))}
      </div>
    </div>
  );
}
