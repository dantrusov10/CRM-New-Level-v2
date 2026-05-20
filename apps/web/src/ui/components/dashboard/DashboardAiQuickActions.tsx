import React from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCw, Sparkles, Target } from "lucide-react";
import { Button } from "../Button";
import { analyzeDealWithAi } from "../../../lib/aiGateway";
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
  const [scoringBusy, setScoringBusy] = React.useState(false);
  const [scoringProgress, setScoringProgress] = React.useState("");

  async function refreshScoringBatch() {
    const targets = priorityDeals.slice(0, 5);
    if (!targets.length) {
      toast.error("Нет приоритетных сделок для пересчёта скоринга");
      return;
    }
    setScoringBusy(true);
    let ok = 0;
    try {
      for (let i = 0; i < targets.length; i++) {
        const d = targets[i];
        setScoringProgress(`${i + 1}/${targets.length}`);
        try {
          await analyzeDealWithAi({
            dealId: d.id,
            taskCode: "deal_analysis",
            context: { refresh_scoring_only: true, source: "dashboard_batch" },
          });
          ok += 1;
        } catch (e) {
          const msg = e instanceof Error ? e.message : "ошибка";
          toast.error(`Сделка «${d.title || d.id}»: ${msg}`);
        }
      }
      if (ok) toast.success(`Скоринг обновлён для ${ok} сделок`);
    } finally {
      setScoringBusy(false);
      setScoringProgress("");
    }
  }

  function openTopPriority() {
    const top = priorityDeals[0];
    if (top?.id) nav(`/deals/${top.id}`);
    else toast.error("Нет приоритетной сделки в текущем срезе");
  }

  return (
    <div className="ui-card p-4">
      <div className="text-sm font-extrabold mb-1">AI — быстрые действия</div>
      <div className="text-xs text-text2 mb-3">Три сценария с дашборда: вывод, пересчёт скоринга, переход к приоритету</div>
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
        <Button small variant="secondary" disabled={scoringBusy} onClick={() => void refreshScoringBatch()}>
          <span className="inline-flex items-center gap-1.5">
            <RefreshCw size={14} className={scoringBusy ? "animate-spin" : ""} />
            {scoringBusy ? `Скоринг ${scoringProgress}` : "Пересчитать скоринг (топ-5)"}
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
        Скоринг вызывает AI Gateway (
        {String((import.meta.env.VITE_AI_GATEWAY_URL as string) || "control.nwlvl.ru")}
        ). Пользователь: {String((pb.authStore.model as { email?: string } | null)?.email || "—")}
      </div>
    </div>
  );
}
