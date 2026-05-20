import React from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Target } from "lucide-react";
import { Button } from "../Button";
import { pb } from "../../../lib/pb";
import { toast } from "../../../lib/toast";

type PriorityDeal = { id: string; title?: string };

export function DashboardAiQuickActions({
  priorityDeals,
  onRefreshSummary,
  summaryLoading,
}: {
  priorityDeals: PriorityDeal[];
  onRefreshSummary: () => void | Promise<void>;
  summaryLoading?: boolean;
}) {
  const nav = useNavigate();

  function openTopPriority() {
    const top = priorityDeals[0];
    if (top?.id) nav(`/deals/${top.id}`);
    else toast.error("Нет приоритетной сделки в текущем срезе");
  }

  return (
    <div className="ui-card p-4">
      <div className="text-sm font-extrabold mb-1">AI — быстрые действия</div>
      <div className="text-xs text-text2 mb-3">
        Обновить сводку дашборда или перейти к приоритетной сделке. Скоринг и анализ — в карточке сделки («Обновить AI-анализ»).
      </div>
      <div className="flex flex-col sm:flex-row flex-wrap gap-2">
        <Button
          small
          variant="secondary"
          disabled={summaryLoading}
          onClick={() => void onRefreshSummary()}
        >
          <span className="inline-flex items-center gap-1.5">
            <Sparkles size={14} />
            {summaryLoading ? "Обновление…" : "Обновить AI-вывод"}
          </span>
        </Button>
        <Button small variant="primary" onClick={openTopPriority}>
          <span className="inline-flex items-center gap-1.5">
            <Target size={14} />
            Открыть приоритет №1
          </span>
        </Button>
      </div>
      <div className="mt-2 text-[11px] text-text2">
        Обогащение реквизитов — по ИНН в карточке сделки. Gateway:{" "}
        {String((import.meta.env.VITE_AI_GATEWAY_URL as string) || "control.nwlvl.ru")}
        {" · "}
        {String((pb.authStore.model as { email?: string } | null)?.email || "—")}
      </div>
    </div>
  );
}
