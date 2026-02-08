import React from "react";
import { useSearchParams } from "react-router-dom";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Card, CardContent, CardHeader } from "../../components/Card";
import { useFunnelStages, useDeals } from "../../data/hooks";
import { KanbanColumn } from "./components/KanbanColumn";
import { KanbanCard } from "./components/KanbanCard";
import { pb } from "../../../lib/pb";

function money(n: number) {
  return n.toLocaleString("ru-RU");
}

function dealAmount(d: any) {
  // For MVP: show/aggregate by budget; fallback to turnover.
  const b = Number(d?.budget ?? 0);
  const t = Number(d?.turnover ?? 0);
  return b || t || 0;
}

export function DealsKanbanPage() {
  const [sp] = useSearchParams();
  const stageOnly = sp.get("stage") ?? "";
  const owner = sp.get("owner") ?? "";
  const channel = sp.get("channel") ?? "";

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 }, // feels more "attached" and avoids accidental drags
    })
  );

  const stagesQ = useFunnelStages();
  const filter = [
    owner ? `responsible_id="${owner}"` : "",
    channel ? `sales_channel="${channel.replace(/"/g, "\\\"")}"` : "",
    stageOnly ? `stage_id="${stageOnly}"` : "",
  ]
    .filter(Boolean)
    .join(" && ");

  const dealsQ = useDeals({ filter, page: 1, perPage: 500 });

  const stages = stageOnly ? (stagesQ.data ?? []).filter((s) => s.id === stageOnly) : stagesQ.data ?? [];
  const deals = dealsQ.data?.items ?? [];

  const dealsByStage = React.useMemo(() => {
    const m: Record<string, any[]> = {};
    for (const s of stages) m[s.id] = [];
    for (const d of deals as any[]) {
      const sid = d.stage_id ?? d.expand?.stage_id?.id;
      if (sid && m[sid]) m[sid].push(d);
    }
    return m;
  }, [stages, deals]);

  const stageStats = React.useMemo(() => {
    const out: Record<string, { count: number; sum: number }> = {};
    for (const s of stages) out[s.id] = { count: 0, sum: 0 };
    for (const s of stages) {
      const arr = dealsByStage[s.id] ?? [];
      out[s.id] = {
        count: arr.length,
        sum: arr.reduce((acc, d) => acc + dealAmount(d), 0),
      };
    }
    return out;
  }, [stages, dealsByStage]);

  // Top analytics (like in your prototype): simple and useful.
  const topStats = React.useMemo(() => {
    const all = deals as any[];
    const openCount = all.length;
    const pipeline = all.reduce((acc, d) => acc + dealAmount(d), 0);

    // Weighted: if current_score exists -> amount * score/100
    const weighted = all.reduce((acc, d) => {
      const score = Number(d?.current_score ?? 0);
      return acc + dealAmount(d) * (score > 0 ? score / 100 : 0);
    }, 0);

    const hot = all.filter((d) => Number(d?.current_score ?? 0) >= 70).length;

    return { openCount, pipeline, weighted, hot };
  }, [deals]);

  const [activeDealId, setActiveDealId] = React.useState<string | null>(null);
  const activeDeal = React.useMemo(() => (activeDealId ? (deals as any[]).find((d) => d.id === activeDealId) : null), [activeDealId, deals]);

  function getStageIdByDealId(dealId: string): string | null {
    for (const s of stages) {
      const arr = dealsByStage[s.id] ?? [];
      if (arr.some((d) => String(d.id) === String(dealId))) return s.id;
    }
    return null;
  }

  function resolveDestinationStageId(overId: string): string | null {
    // 1) If dropped onto column droppable zone → stage id
    if (stages.some((s) => s.id === overId)) return overId;
    // 2) If dropped onto another card → stage of that card
    const stageId = getStageIdByDealId(overId);
    return stageId;
  }

  function onDragStart(ev: DragStartEvent) {
    setActiveDealId(String(ev.active.id));
  }

  async function onDragEnd(ev: DragEndEvent) {
    const dealId = String(ev.active.id);
    const overId = ev.over?.id ? String(ev.over.id) : null;
    setActiveDealId(null);
    if (!overId) return;

    const newStageId = resolveDestinationStageId(overId);
    if (!newStageId) return;

    const deal = (deals as any[]).find((x) => x.id === dealId);
    if (!deal || deal.stage_id === newStageId) return;

    await pb.collection("deals").update(dealId, { stage_id: newStageId });

    // Timeline schema: deal_id + comment + payload + timestamp
    await pb
      .collection("timeline")
      .create({
        deal_id: dealId,
        user_id: pb.authStore.model?.id ?? null,
        action: "stage_change",
        comment: `Смена этапа: ${String(deal.expand?.stage_id?.stage_name ?? "").trim()} → ${(stages.find((s) => s.id === newStageId) as any)?.stage_name ?? ""}`,
        payload: { from: deal.stage_id ?? null, to: newStageId },
        timestamp: new Date().toISOString(),
      })
      .catch(() => {});

    await dealsQ.refetch();
  }

  return (
    <Card className="min-w-0">
      <CardHeader>
        <div className="text-sm font-semibold">Канбан</div>
        <div className="text-xs text-text2 mt-1">Drag&Drop между этапами, логирование переходов (US-02)</div>
      </CardHeader>

      <CardContent className="min-w-0">
        {stagesQ.isLoading || dealsQ.isLoading ? (
          <div className="text-sm text-text2">Загрузка...</div>
        ) : (
          <>
            {/* Top analytics */}
            <div className="grid grid-cols-4 gap-4 mb-4">
              <div className="rounded-card border border-border bg-white p-4">
                <div className="text-xs text-text2">Открытых сделок</div>
                <div className="text-xl font-semibold mt-1">{topStats.openCount}</div>
                <div className="text-xs text-text2 mt-1">в работе сейчас</div>
              </div>
              <div className="rounded-card border border-border bg-white p-4">
                <div className="text-xs text-text2">Пайплайн</div>
                <div className="text-xl font-semibold mt-1">{money(topStats.pipeline)} ₽</div>
                <div className="text-xs text-text2 mt-1">сумма по сделкам</div>
              </div>
              <div className="rounded-card border border-border bg-white p-4">
                <div className="text-xs text-text2">Взвешенный пайплайн</div>
                <div className="text-xl font-semibold mt-1">{money(Math.round(topStats.weighted))} ₽</div>
                <div className="text-xs text-text2 mt-1">с учётом score</div>
              </div>
              <div className="rounded-card border border-border bg-white p-4">
                <div className="text-xs text-text2">Горячих (≥70)</div>
                <div className="text-xl font-semibold mt-1">{topStats.hot}</div>
                <div className="text-xs text-text2 mt-1">приоритет на неделю</div>
              </div>
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            >
              {/* Horizontal scroll only inside the kanban strip */}
              <div className="min-w-0 overflow-x-auto pb-2">
                <div className="grid auto-cols-[320px] grid-flow-col gap-4 min-w-max">
                  {stages.map((s) => (
                    <SortableContext
                      key={s.id}
                      items={(dealsByStage[s.id] ?? []).map((d) => d.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <KanbanColumn stage={s} deals={dealsByStage[s.id] ?? []} stats={stageStats[s.id]} />
                    </SortableContext>
                  ))}
                </div>
              </div>

              <DragOverlay>
                {activeDeal ? (
                  <div className="opacity-95">
                    <KanbanCard deal={activeDeal} stageColor={activeDeal.expand?.stage_id?.color ?? "#004EEB"} overlay />
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </>
        )}
      </CardContent>
    </Card>
  );
}
