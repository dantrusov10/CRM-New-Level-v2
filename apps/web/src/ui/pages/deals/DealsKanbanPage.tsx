import React from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  CollisionDetection,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { Card, CardContent, CardHeader } from "../../components/Card";
import { useFunnelStages, useDeals } from "../../data/hooks";
import type { Deal, FunnelStage } from "../../../lib/types";
import { KanbanColumn } from "./components/KanbanColumn";
import { KanbanCard } from "./components/KanbanCard";
import { pb } from "../../../lib/pb";

function money(n: number) {
  return n.toLocaleString("ru-RU");
}

function dealAmount(d: Deal) {
  // For MVP: show/aggregate by budget; fallback to turnover.
  const b = Number(d?.budget ?? 0);
  const t = Number(d?.turnover ?? 0);
  return b || t || 0;
}

export function DealsKanbanPage() {
  const kanbanScrollRef = React.useRef<HTMLDivElement | null>(null);
  const miniTrackRef = React.useRef<HTMLDivElement | null>(null);
  const [miniViewport, setMiniViewport] = React.useState({ left: 0, width: 40 });

  // Space + drag to pan horizontally (like Figma). This avoids relying only on Shift+wheel
  // and is more discoverable than middle-mouse (which can trigger browser auto-scroll).
  const spaceDownRef = React.useRef(false);
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") spaceDownRef.current = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") spaceDownRef.current = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);
  React.useEffect(() => {
    const el = kanbanScrollRef.current;
    if (!el) return;
    const syncMini = () => {
      const scrollWidth = Math.max(1, el.scrollWidth);
      const clientWidth = Math.max(1, el.clientWidth);
      const trackW = miniTrackRef.current?.clientWidth || 200;
      const thumbW = Math.max(28, Math.round((clientWidth / scrollWidth) * trackW));
      const maxLeft = Math.max(0, trackW - thumbW);
      const left = Math.round((el.scrollLeft / Math.max(1, scrollWidth - clientWidth)) * maxLeft);
      setMiniViewport({ left: Number.isFinite(left) ? left : 0, width: thumbW });
    };
    syncMini();
    el.addEventListener("scroll", syncMini, { passive: true });
    window.addEventListener("resize", syncMini);
    return () => {
      el.removeEventListener("scroll", syncMini);
      window.removeEventListener("resize", syncMini);
    };
  }, []);

  React.useEffect(() => {
    const el = kanbanScrollRef.current;
    if (!el) return;

    let dragging = false;
    let startX = 0;
    let startLeft = 0;

    const onMouseDown = (e: MouseEvent) => {
      // middle mouse OR space+left mouse
      const isMiddle = e.button === 1;
      const isSpacePan = spaceDownRef.current && e.button === 0;
      if (!isMiddle && !isSpacePan) return;
      dragging = true;
      startX = e.clientX;
      startLeft = el.scrollLeft;
      e.preventDefault();
      e.stopPropagation();
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      el.scrollLeft = startLeft - dx;
    };

    const onMouseUp = () => {
      dragging = false;
    };

    const onWheel = (e: WheelEvent) => {
      // Keep normal vertical scroll for the page.
      // Horizontal scroll for kanban: Shift + wheel (common pattern), or trackpad deltaX.
      if (e.shiftKey) {
        el.scrollLeft += e.deltaY;
        e.preventDefault();
        return;
      }
      if (Math.abs(e.deltaX) > 0 && Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        el.scrollLeft += e.deltaX;
        e.preventDefault();
      }
    };

    // Prevent Chrome's default middle-click auto-scroll from stealing the interaction.
    const onAuxClick = (e: MouseEvent) => {
      if (e.button === 1) e.preventDefault();
    };

    el.addEventListener("mousedown", onMouseDown);
    el.addEventListener("auxclick", onAuxClick);
    el.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      el.removeEventListener("mousedown", onMouseDown);
      el.removeEventListener("auxclick", onAuxClick as EventListener);
      el.removeEventListener("wheel", onWheel as EventListener);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);
  const [sp, setSp] = useSearchParams();
  const stageOnly = sp.get("stage") ?? "";
  const owner = sp.get("owner") ?? "";
  const channel = sp.get("channel") ?? "";
  const view = sp.get("view") ?? "";
  const scoreMax = sp.get("scoreMax") ?? "";
  const fromIso = sp.get("from") ?? "";

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 }, // feels more "attached" and avoids accidental drags
    })
  );

  // Better drop into empty columns: prioritize pointer collisions, fallback to rectangle intersection.
  const collisionDetection: CollisionDetection = React.useCallback((args) => {
    const pointer = pointerWithin(args);
    if (pointer.length) return pointer;
    return rectIntersection(args);
  }, []);

  const stagesQ = useFunnelStages();
  const filter = [
    owner ? `responsible_id="${owner}"` : "",
    channel ? `sales_channel="${channel.replace(/"/g, "\\\"")}"` : "",
    stageOnly ? `stage_id="${stageOnly}"` : "",
    scoreMax ? `current_score <= ${Number(scoreMax)}` : "",
    fromIso ? `created >= "${new Date(fromIso).toISOString().slice(0, 19).replace("T", " ")}"` : "",
  ]
    .filter(Boolean)
    .join(" && ");

  const dealsQ = useDeals({ filter });

  const stages = stageOnly ? (stagesQ.data ?? []).filter((s) => s.id === stageOnly) : stagesQ.data ?? [];
  const deals = dealsQ.data ?? [];

  const dealsByStage = React.useMemo(() => {
    const m: Record<string, Deal[]> = {};
    for (const s of stages) m[s.id] = [];
    for (const d of deals) {
      const sid = d.stage_id ?? d.expand?.stage_id?.id;
      if (sid && m[sid]) m[sid].push(d);
    }
    return m;
  }, [stages, deals]);

  // Local UI state for drag preview ("cards расступаются" during drag&drop)
  const [itemsByStage, setItemsByStage] = React.useState<Record<string, string[]>>({});

  const dealsMap = React.useMemo(() => {
    const m: Record<string, Deal> = {};
    for (const d of deals) m[String(d.id)] = d;
    return m;
  }, [deals]);

  React.useEffect(() => {
    const next: Record<string, string[]> = {};
    for (const s of stages) next[s.id] = (dealsByStage[s.id] ?? []).map((d) => String(d.id));
    setItemsByStage(next);
  }, [stages, dealsByStage]);

  function findContainer(id: string): string | null {
    if (stages.some((s) => s.id === id)) return id;
    for (const s of stages) {
      const arr = itemsByStage[s.id] ?? [];
      if (arr.includes(id)) return s.id;
    }
    return null;
  }

  const orderedDealsByStage = React.useMemo(() => {
    const out: Record<string, Deal[]> = {};
    for (const s of stages) {
      const ids = itemsByStage[s.id] ?? [];
      out[s.id] = ids.map((id) => dealsMap[id]).filter(Boolean);
    }
    return out;
  }, [stages, itemsByStage, dealsMap]);



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
    const all = deals;
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
  const [overlayWidth, setOverlayWidth] = React.useState<number | null>(null);
  const lastOverIdRef = React.useRef<string | null>(null);
  const activeDeal = React.useMemo(() => (activeDealId ? deals.find((d) => d.id === activeDealId) ?? null : null), [activeDealId, deals]);

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
    const id = String(ev.active.id);
    setActiveDealId(id);
    lastOverIdRef.current = null;

    // DragOverlay is rendered in document.body; if we don't pin width, it can stretch across columns.
    // We measure the *column content* width (column width minus padding), so the grabbed card is always the same size.
    const el = document.querySelector(`[data-kanban-card-id="${CSS.escape(id)}"]`) as HTMLElement | null;
    if (el) {
      const col = el.closest(`[data-kanban-column="true"]`) as HTMLElement | null;
      if (col) {
        const colRect = col.getBoundingClientRect();
        const styles = window.getComputedStyle(col);
        const padL = parseFloat(styles.paddingLeft || "0") || 0;
        const padR = parseFloat(styles.paddingRight || "0") || 0;
        const w = Math.max(200, Math.round(colRect.width - padL - padR));
        setOverlayWidth(w);
        return;
      }
      setOverlayWidth(Math.round(el.getBoundingClientRect().width));
      return;
    }

    // Fallback: dnd-kit rect
    const rectW = ev.active?.rect?.current?.initial?.width;
    if (rectW && Number.isFinite(rectW)) setOverlayWidth(Math.round(rectW));
  }

  function onDragOver(ev: DragOverEvent) {
    const activeId = String(ev.active.id);
    const overId = ev.over?.id ? String(ev.over.id) : null;
    if (!overId) return;

    // Reduce re-renders: only react when the hovered target actually changes.
    if (lastOverIdRef.current === overId) return;
    lastOverIdRef.current = overId;

    const activeContainer = findContainer(activeId);
    const overContainer = findContainer(overId) ?? (stages.some((s) => s.id === overId) ? overId : null);

    if (!activeContainer || !overContainer) return;

    setItemsByStage((prev) => {
      const fromItems = (prev[activeContainer] ?? []).slice();
      const toItems = (prev[overContainer] ?? []).slice();

      // Reorder within the same column (shows insertion position)
      if (activeContainer === overContainer) {
        const oldIndex = fromItems.indexOf(activeId);
        const newIndex = fromItems.indexOf(overId);
        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return prev;
        return { ...prev, [activeContainer]: arrayMove(fromItems, oldIndex, newIndex) };
      }

      // Move across columns (cards "расступаются" live)
      const oldIndex = fromItems.indexOf(activeId);
      if (oldIndex === -1) return prev;
      fromItems.splice(oldIndex, 1);

      // Insert before the hovered card; if hovered over the column itself → append
      const overIndex = toItems.indexOf(overId);
      if (overIndex >= 0) toItems.splice(overIndex, 0, activeId);
      else toItems.push(activeId);

      return { ...prev, [activeContainer]: fromItems, [overContainer]: toItems };
    });
  }

  async function onDragEnd(ev: DragEndEvent) {
    const dealId = String(ev.active.id);
    const overId = ev.over?.id ? String(ev.over.id) : null;
    setActiveDealId(null);
    setOverlayWidth(null);
    lastOverIdRef.current = null;
    if (!overId) return;

    const newStageId = resolveDestinationStageId(overId);
    if (!newStageId) return;

    const deal = deals.find((x) => x.id === dealId);
    if (!deal || deal.stage_id === newStageId) return;

    await pb.collection("deals").update(dealId, { stage_id: newStageId });

    // Timeline schema: deal_id + comment + payload + timestamp
    await pb
      .collection("timeline")
      .create({
        deal_id: dealId,
        user_id: pb.authStore.model?.id ?? null,
        action: "stage_change",
        comment: `Смена этапа: ${String(deal.expand?.stage_id?.stage_name ?? "").trim()} → ${stages.find((s) => s.id === newStageId)?.stage_name ?? ""}`,
        payload: { from: deal.stage_id ?? null, to: newStageId },
        timestamp: new Date().toISOString(),
      })
      .catch(() => {});

    await dealsQ.refetch();
  }

  return (
    <Card className="min-w-0">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-base font-extrabold tracking-wide">Канбан по воронке</div>
            <div className="text-xs text-text2 mt-1">Быстрый обзор этапов, сумм и приоритетов.</div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              className={`ui-btn ${view === "risk" ? "ui-btn-primary" : "ui-btn-secondary"} h-9 text-sm`}
              onClick={() => {
                const n = new URLSearchParams(sp);
                n.set("view", "risk");
                n.set("scoreMax", "49");
                setSp(n, { replace: true });
              }}
            >
              Мои сделки в риске
            </button>
            <button
              className={`ui-btn ${view === "talks_week" ? "ui-btn-primary" : "ui-btn-secondary"} h-9 text-sm`}
              onClick={() => {
                const n = new URLSearchParams(sp);
                n.set("view", "talks_week");
                n.set("from", new Date(new Date().setDate(new Date().getDate() - 7)).toISOString());
                setSp(n, { replace: true });
              }}
            >
              Переговоры этой недели
            </button>
            <button
              className="ui-btn ui-btn-secondary h-9 text-sm"
              onClick={() => {
                const n = new URLSearchParams(sp);
                n.delete("view");
                n.delete("scoreMax");
                n.delete("from");
                setSp(n, { replace: true });
              }}
            >
              Сброс вида
            </button>
            <div className="rounded-md border border-[rgba(87,183,255,0.35)] bg-[rgba(45,123,255,0.18)] px-3 py-1 text-xs font-semibold text-text">
              Живая доска
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="min-w-0">
        {stagesQ.isLoading || dealsQ.isLoading ? (
          <div className="text-sm text-text2">Загрузка...</div>
        ) : (
          <>
            {/* Top analytics */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
              <div className="rounded-card border border-[rgba(87,183,255,0.24)] bg-[#14345b] p-4">
                <div className="text-xs text-text2">Открытые сделки</div>
                <div className="text-xl font-semibold mt-1">{topStats.openCount}</div>
                <div className="text-xs text-text2 mt-1">в работе сейчас</div>
              </div>
              <div className="rounded-card border border-[rgba(87,183,255,0.24)] bg-[#123053] p-4">
                <div className="text-xs text-text2">Потенциал выручки</div>
                <div className="text-xl font-semibold mt-1">{money(topStats.pipeline)} ₽</div>
                <div className="text-xs text-text2 mt-1">сумма по сделкам</div>
              </div>
              <div className="rounded-card border border-[rgba(87,183,255,0.24)] bg-[#102947] p-4">
                <div className="text-xs text-text2">Взвешенный потенциал</div>
                <div className="text-xl font-semibold mt-1">{money(Math.round(topStats.weighted))} ₽</div>
                <div className="text-xs text-text2 mt-1">с учётом вероятности</div>
              </div>
              <div className="rounded-card border border-[rgba(87,183,255,0.24)] bg-[#0f2744] p-4">
                <div className="text-xs text-text2">Горячие (вероятность ≥70)</div>
                <div className="text-xl font-semibold mt-1">{topStats.hot}</div>
                <div className="text-xs text-text2 mt-1">приоритет на неделю</div>
              </div>
              <div className="pointer-events-none fixed bottom-3 right-4 z-20 rounded-xl border border-[rgba(255,255,255,0.22)] bg-[rgba(15,23,42,0.82)] p-2 shadow-[0_0_24px_rgba(45,123,255,0.28)]">
                <div className="mb-1 text-[10px] text-text2">Навигация по доске</div>
                <div
                  ref={miniTrackRef}
                  className="pointer-events-auto relative h-5 w-56 rounded-md bg-[rgba(255,255,255,0.12)]"
                  onMouseDown={(e) => {
                    const track = miniTrackRef.current;
                    const scroll = kanbanScrollRef.current;
                    if (!track || !scroll) return;
                    const rect = track.getBoundingClientRect();
                    const clickX = e.clientX - rect.left;
                    const maxLeft = Math.max(0, rect.width - miniViewport.width);
                    const nextLeft = Math.max(0, Math.min(maxLeft, clickX - miniViewport.width / 2));
                    const ratio = nextLeft / Math.max(1, maxLeft);
                    scroll.scrollLeft = ratio * Math.max(1, scroll.scrollWidth - scroll.clientWidth);
                  }}
                >
                  <div
                    className="absolute top-0 h-5 rounded-md border border-[rgba(51,215,255,0.65)] bg-[rgba(51,215,255,0.35)]"
                    style={{ left: miniViewport.left, width: miniViewport.width }}
                  />
                </div>
              </div>
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={collisionDetection}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDragEnd={onDragEnd}
            >
              {/* Horizontal scroll only inside the kanban strip */}
              <div
                ref={kanbanScrollRef}
                className="min-w-0 overflow-x-auto overflow-y-hidden neon-scroll rounded-card border border-border bg-[rgba(17,24,39,0.18)] p-3"
              >
                <div className="grid auto-cols-[320px] grid-flow-col gap-4 min-w-max">
                  {stages.map((s) => (
                    <SortableContext
                      key={s.id}
                      items={(itemsByStage[s.id] ?? [])}
                      strategy={verticalListSortingStrategy}
                    >
                      <KanbanColumn stage={s} deals={orderedDealsByStage[s.id] ?? []} stats={stageStats[s.id]} />
                    </SortableContext>
                  ))}
                </div>
              </div>

              {createPortal(
                <DragOverlay>
                  {activeDeal ? (
                    <div
                      className="opacity-95"
                      // If width is not pinned, the overlay is rendered in <body>
                      // and `width: 100%` cards will stretch across multiple columns.
                      // Fallback to the column width (320) minus paddings.
                      style={{ width: `${overlayWidth ?? 296}px` }}
                    >
                      <KanbanCard
                        deal={activeDeal}
                        stageColor={activeDeal.expand?.stage_id?.color ?? "#004EEB"}
                        overlay
                      />
                    </div>
                  ) : null}
                </DragOverlay>,
                document.body
              )}
            </DndContext>
          </>
        )}
      </CardContent>
    </Card>
  );
}
