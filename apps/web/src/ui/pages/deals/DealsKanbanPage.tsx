import React from "react";
import { useSearchParams } from "react-router-dom";
import { DndContext, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useFunnelStages, useDeals } from "../../data/hooks";
import { Card, CardContent, CardHeader } from "../../components/Card";
import { KanbanColumn } from "./components/KanbanColumn";
import { pb } from "../../../lib/pb";

export function DealsKanbanPage() {
  const [sp] = useSearchParams();
  const stageOnly = sp.get("stage") ?? "";
  const owner = sp.get("owner") ?? "";
  const channel = sp.get("channel") ?? "";

  const stagesQ = useFunnelStages();
  const filter = [
    // PocketBase schema
    owner ? `responsible_id="${owner}"` : "",
    channel ? `sales_channel="${channel.replace(/\"/g, "\\\"")}"` : "",
    stageOnly ? `stage_id="${stageOnly}"` : "",
  ].filter(Boolean).join(" && ");

  const dealsQ = useDeals({ filter });

  const stages = stageOnly ? (stagesQ.data ?? []).filter((s) => s.id === stageOnly) : (stagesQ.data ?? []);
  const deals = dealsQ.data ?? [];

  const dealsByStage = React.useMemo(() => {
    const m: Record<string, any[]> = {};
    for (const s of stages) m[s.id] = [];
    for (const d of deals as any[]) {
      const sid = d.stage_id ?? d.expand?.stage_id?.id;
      if (sid && m[sid]) m[sid].push(d);
    }
    return m;
  }, [stages, deals]);

  async function onDragEnd(ev: DragEndEvent) {
    const dealId = String(ev.active.id);
    const overId = ev.over?.id ? String(ev.over.id) : null;
    if (!overId) return;
    // overId is stageId (drop zone)
    const newStageId = overId;
    const deal = (deals as any[]).find((x) => x.id === dealId);
    if (!deal || deal.stage_id === newStageId) return;
    await pb.collection("deals").update(dealId, { stage_id: newStageId });
    // Timeline schema: deal_id + comment + payload + timestamp
    await pb.collection("timeline").create({
      deal_id: dealId,
      user_id: pb.authStore.model?.id ?? null,
      action: "stage_change",
      comment: `Смена этапа: ${(deal.expand?.stage_id?.stage_name ?? "").trim()} → ${(stages.find((s) => s.id === newStageId) as any)?.stage_name ?? ""}`,
      payload: { from: deal.stage_id, to: newStageId },
      timestamp: new Date().toISOString(),
    }).catch(() => {});
    await dealsQ.refetch();
  }

  return (
    <Card>
      <CardHeader>
        <div className="text-sm font-semibold">Канбан</div>
        <div className="text-xs text-text2 mt-1">Drag&Drop между этапами, логирование переходов (US-02)</div>
      </CardHeader>
      <CardContent>
        {stagesQ.isLoading || dealsQ.isLoading ? (
          <div className="text-sm text-text2">Загрузка...</div>
        ) : (
          <DndContext onDragEnd={onDragEnd}>
            <div className="grid auto-cols-[320px] grid-flow-col gap-4 overflow-x-auto pb-2">
              {stages.map((s) => (
                <SortableContext key={s.id} items={(dealsByStage[s.id] ?? []).map((d) => d.id)} strategy={verticalListSortingStrategy}>
                  <KanbanColumn stage={s} deals={dealsByStage[s.id] ?? []} />
                </SortableContext>
              ))}
            </div>
          </DndContext>
        )}
      </CardContent>
    </Card>
  );
}
