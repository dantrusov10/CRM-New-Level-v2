import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useNavigate } from "react-router-dom";

function money(n: number) {
  return n.toLocaleString("ru-RU");
}

function dealAmount(d: any) {
  const b = Number(d?.budget ?? 0);
  const t = Number(d?.turnover ?? 0);
  return b || t || 0;
}

export function KanbanCard({
  deal,
  stageColor,
  overlay,
}: {
  deal: any;
  stageColor: string;
  overlay?: boolean;
}) {
  const nav = useNavigate();

  const sortable = useSortable({ id: deal.id, disabled: Boolean(overlay) });
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = sortable;

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    // makes pointer-based dragging feel more reliable
    touchAction: "none",
  };

  const score = Number(deal?.current_score ?? 0);
  const amount = dealAmount(deal);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(overlay ? {} : attributes)}
      {...(overlay ? {} : listeners)}
      className="rounded-card border border-[rgba(255,255,255,0.14)] bg-[rgba(17,24,39,0.32)] cursor-grab active:cursor-grabbing select-none shadow-sm text-white backdrop-blur-[14px]"
      onDoubleClick={() => nav(`/deals/${deal.id}`)}
      title="Двойной клик — открыть карточку"
    >
      <div className="h-1 w-full rounded-t-card" style={{ background: stageColor }} />
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{deal.title}</div>
            <div className="text-xs text-[rgba(226,232,240,0.70)] mt-1 truncate">{deal.expand?.company_id?.name ?? "—"}</div>
          </div>

          {score ? (
            <div className="text-xs font-semibold rounded-card border border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.08)] px-2 py-1 tabular-nums text-[rgba(226,232,240,0.92)]">
              {score}%
            </div>
          ) : null}
        </div>

        <div className="mt-2 text-xs text-[rgba(226,232,240,0.70)] tabular-nums">
          {amount ? `Сумма: ${money(amount)} ₽` : "Сумма: —"}
        </div>

        {deal?.expected_payment_date ? (
          <div className="mt-1 text-xs text-text2">Оплата: {String(deal.expected_payment_date).slice(0, 10)}</div>
        ) : null}
      </div>
    </div>
  );
}
