import React from "react";
import type { FunnelStage } from "../../../../lib/types";
import { useDroppable } from "@dnd-kit/core";
import { KanbanCard } from "./KanbanCard";

export function KanbanColumn({ stage, deals }: { stage: FunnelStage; deals: any[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  return (
    <div
      ref={setNodeRef}
      className="rounded-card border border-border bg-[#EEF1F6] p-3"
      style={{ outline: isOver ? "2px solid #004EEB" : "none" }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-text">{stage.name}</div>
        <div className="text-xs text-text2">{deals.length}</div>
      </div>
      <div className="grid gap-2">
        {deals.map((d) => (
          <KanbanCard key={d.id} deal={d} stageColor={stage.color} />
        ))}
      </div>
    </div>
  );
}
