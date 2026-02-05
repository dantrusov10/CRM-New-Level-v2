import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useNavigate } from "react-router-dom";

export function KanbanCard({ deal, stageColor }: { deal: any; stageColor: string }) {
  const nav = useNavigate();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: deal.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="rounded-card border border-border bg-white cursor-grab active:cursor-grabbing"
      onDoubleClick={() => nav(`/deals/${deal.id}`)}
      title="Двойной клик — открыть карточку"
    >
      <div className="h-1 w-full rounded-t-card" style={{ background: stageColor }} />
      <div className="p-3">
        <div className="text-sm font-medium">{deal.name}</div>
        <div className="text-xs text-text2 mt-1">{deal.expand?.company?.name ?? "—"}</div>
        <div className="mt-2 text-xs text-text2 tabular-nums">
          {deal.turnover ? `Оборот: ${deal.turnover.toLocaleString("ru-RU")}` : "Оборот: —"}
        </div>
      </div>
    </div>
  );
}
